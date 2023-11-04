import * as ts from "typescript";
import * as path from "path";
import { BaseMethodSignature, BaseNode, ClassMemberFlags, ClassMethod, ClassObjectLiteral, ClassProperty, Declaration, DeclarationKind, FunctionParameter, ElementParameterFlags, IndexSignature, ItemPath, JSDocData, JSDocTag, LoC, Method, MethodFlags, MethodSignature, Module, NEVER_TYPE, ObjectLiteral, PropertyFlags, PropertySignature, Type, TypeKind, TypeParameter, TypeReference, TypeReferenceKind, EnumDeclaration, EnumMember, FunctionDeclaration, ConstantDeclaration, TypeAliasDeclaration, InterfaceDeclaration, ClassDeclaration, FileExports, ExportedTypeReference, ReExportedItem, ReferenceType } from "./structure";
import { BitField, PackageJSON, getFileNameFromPath, getSymbolDeclaration, getSymbolTypeKind, hasModifier, isNamespaceSymbol, joinPartOfArray, mapRealValues } from "./utils";
import { HookManager } from "./hookManager";

export type TypescriptExtractorHooks = {
    registerItem: (extractor: TypescriptExtractor, decl: Declaration, ref: TypeReference, currentModule: Module) => void,
    resolveExternalLink: (extractor: TypescriptExtractor, typeName: ts.Symbol, typeKind: TypeReferenceKind, lib: string, extraPath: string[]) => string | undefined;
}

export interface TypescriptExtractorSettings {
    /**
     * Where to look for dependencies. For example, if you're using node, it would be "node_modules".
     */
    moduleStorage: string,
    maxConstContentLen: number,
    /**
    * Any provided folder names won't count as modules, items inside will be included in the parent module.
    */
    passthroughModules?: string[],
    gitBranch?: string
}

export interface Shared {
    program: ts.Program,
    checker: ts.TypeChecker,
    moduleCache: Record<string, Module>,
    referenceCache: Map<ts.Symbol, TypeReference>,
    hooks: HookManager<TypescriptExtractorHooks>
}

export interface TypescriptProjectDetails {
    name: string,
    basePath: string,
    absolutePath: string,
    tsconfig: ts.ParsedCommandLine,
    packageJSON?: PackageJSON,
    settings: TypescriptExtractorSettings
}

/**
 * Extracts modules from a single typescript project. The `basePath` constructor
 * parameter **needs** to be an absolute path.
 */
export class TypescriptExtractor {
    module: Module;
    packageJSON?: PackageJSON;
    shared: Shared;
    settings: TypescriptExtractorSettings;
    tsconfig: ts.ParsedCommandLine;
    constructor(details: TypescriptProjectDetails, shared: Shared) {
        this.shared = shared;
        this.settings = details.settings;
        this.tsconfig = details.tsconfig;
        this.packageJSON = details.packageJSON;
        this.module = TypescriptExtractor.createModule(
            details.name,
            details.absolutePath,
            []
        );
    }

    collect() : void {
        for (const fileName of this.tsconfig.fileNames) {
            const fileObject = this.shared.program.getSourceFile(fileName);
            if (!fileObject || fileObject.isDeclarationFile) continue;
            const fileSym = this.shared.checker.getSymbolAtLocation(fileObject);
            if (!fileSym) continue;

            const currentModule = this.getOrCreateChildModule(fileObject.fileName);
            currentModule.exports[getFileNameFromPath(fileObject.fileName)] = this.registerExports(fileObject, fileSym, currentModule);
        }
    }

    registerExports(fileObj: ts.SourceFile, fileSym: ts.Symbol, currentModule: Module) : FileExports {
        const exports: ExportedTypeReference[] = [];
        const reExports: ReExportedItem[] = [];
        const notDirectReExportsByFile: Record<string, ReExportedItem> = {};

        for (const sym of (fileSym.exports?.values() || [])) {
            const symDeclaration = getSymbolDeclaration(sym);
            if (!symDeclaration) continue;

            const isNamespaceExport = ts.isNamespaceExport(symDeclaration);

            // export * from "./file";
            // export * as Thing from "./file";
            if (BitField.has(sym.flags, ts.SymbolFlags.ExportStar) || isNamespaceExport) {
                const moduleSpecifier = isNamespaceExport ? symDeclaration.parent.moduleSpecifier : (symDeclaration as ts.ExportDeclaration).moduleSpecifier;
                if (!moduleSpecifier) continue;
                const targetModuleSymbol = this.shared.checker.getSymbolAtLocation(moduleSpecifier);
                if (!targetModuleSymbol) continue;
                const targetModuleFileName = getSymbolDeclaration(targetModuleSymbol) as ts.SourceFile;
                const targetModule = this.getOrCreateChildModule(targetModuleFileName.fileName);
                reExports.push({
                    targetModule: targetModule.reference, 
                    references: [], 
                    fileName: getFileNameFromPath(targetModuleFileName.fileName),
                    namespace: isNamespaceExport ? sym.name : undefined,
                    sameModule: currentModule === targetModule
                });
                continue;
            }

            const resolvedSym = this.resolveAliasSymbol(sym);
            const resolvedSymDecl = getSymbolDeclaration(resolvedSym);

            if (!resolvedSymDecl) continue;

            // Handles cases like this:
            // fileA:
            // export * as Thing from "./fileC";
            // fileB:
            // import { Thing } from "./fileA";
            // export { Thing as Thing2 };
            if (ts.isSourceFile(resolvedSymDecl)) {
                const targetModule = this.getOrCreateChildModule(resolvedSymDecl.fileName);
                reExports.push({
                    fileName: getFileNameFromPath(resolvedSymDecl.fileName),
                    targetModule: targetModule.reference,
                    references: [],
                    namespace: sym.name,
                    sameModule: currentModule === targetModule
                });
            }

            // export { A, B, C }
            // some exports might be from the same file
            else if (BitField.has(sym.flags, ts.SymbolFlags.Alias)) {
                const targetSourceFile = getSymbolDeclaration(resolvedSym)?.getSourceFile();
                if (!targetSourceFile) continue;
                const targetModule = this.getOrCreateChildModule(targetSourceFile.fileName);
                const typeRef = this.addSymbol(resolvedSym, targetModule);
                if (!typeRef) continue;
                const alias = sym.name !== resolvedSym.name ? sym.name : undefined;
                if (fileObj === targetSourceFile) exports.push({ reference: typeRef, alias });
                else {
                    if (notDirectReExportsByFile[targetSourceFile.fileName]) notDirectReExportsByFile[targetSourceFile.fileName].references.push({
                        reference: typeRef,
                        alias
                    });
                    else notDirectReExportsByFile[targetSourceFile.fileName] = {
                        targetModule: targetModule.reference,
                        fileName: getFileNameFromPath(targetSourceFile.fileName),
                        sameModule: currentModule === targetModule,
                        references: [{ reference: typeRef, alias }]
                    };
                }
            // Direct exports
            } else {
                const typeRef = this.addSymbol(resolvedSym, currentModule);
                if (typeRef) exports.push({ reference: typeRef });
            }
        }

        return {
            references: exports,
            reExports: [...reExports, ...Object.values(notDirectReExportsByFile)]
        };
    }

    getModuleOfSymbol(symbol: ts.Symbol) : Module | undefined {
        const decl = getSymbolDeclaration(symbol);
        if (!decl) return;
        const file = decl.getSourceFile();
        if (file.isDeclarationFile) return;
        return this.getOrCreateChildModule(file.fileName);
    }

    addSymbol(symbol: ts.Symbol, currentModule?: Module) : TypeReference | undefined {
        if (!currentModule) {
            const module = this.getModuleOfSymbol(symbol);
            if (!module) return;
            currentModule = module;
        }
        if (this.shared.referenceCache.has(symbol)) return this.shared.referenceCache.get(symbol);
        const [type, decl] = this.getSymbolType(symbol);
        if (!type || !decl) return;
        let ref: TypeReference|undefined, declaration: Declaration|undefined;
        if (BitField.has(symbol.flags, ts.SymbolFlags.Class)) [ref, declaration] = this.registerClassDeclaration(symbol, type, decl as ts.ClassDeclaration, currentModule);
        else if (BitField.has(symbol.flags, ts.SymbolFlags.Interface)) [ref, declaration] =  this.registerInterfaceDeclaration(symbol, type, decl as ts.InterfaceDeclaration, currentModule);
        else if (BitField.has(symbol.flags, ts.SymbolFlags.TypeAlias)) [ref, declaration] =  this.registerTypeDeclaraction(symbol, type, decl as ts.TypeAliasDeclaration, currentModule);
        else if (BitField.has(symbol.flags, ts.SymbolFlags.ConstEnum) || BitField.has(symbol.flags, ts.SymbolFlags.RegularEnum)) [ref, declaration] =  this.registerEnumDeclaration(symbol, type, decl as ts.EnumDeclaration, currentModule);
        else if (BitField.has(symbol.flags, ts.SymbolFlags.EnumMember)) {
            this.addSymbol(symbol.parent!);
            return this.shared.referenceCache.get(symbol);
        }
        else if (BitField.has(symbol.flags, ts.SymbolFlags.Function)) [ref, declaration] =  this.registerFunctionDeclaration(symbol, type, decl as ts.FunctionDeclaration, currentModule);
        else if (BitField.has(symbol.flags, ts.SymbolFlags.Variable) && !BitField.has(symbol.flags, ts.SymbolFlags.FunctionScopedVariable)) [ref, declaration] =  this.registerConstantDeclaration(symbol, type, decl as ts.VariableDeclaration, currentModule);
        else if (BitField.has(symbol.flags, ts.SymbolFlags.Module)) return this.registerNamespace(symbol, currentModule)?.[0];
        this.shared.hooks.trigger("registerItem", this, declaration!, ref!, currentModule);
        return ref;
    }

    registerNamespace(symbol: ts.Symbol, currentModule: Module) : [TypeReference, Module] | undefined {
        const [type, decl] = this.getSymbolType<ts.ModuleDeclaration>(symbol);
        if (!type || !decl) return;
        const ref = {
            name: symbol.name,
            path: currentModule.childrenPath,
            kind: TypeReferenceKind.Module
        };
        this.shared.referenceCache.set(symbol, ref);
        // Make sure the parent namespace is registered
        if (!currentModule.namespace && symbol.parent && isNamespaceSymbol(symbol.parent)) {
            const namespaceModule = this.getModuleOfSymbol(symbol.parent);
            if (namespaceModule) {
                const parentNamespace = this.registerNamespace(symbol.parent, namespaceModule);
                if (parentNamespace) currentModule = parentNamespace[1];
            }
        } 
        const newModule = TypescriptExtractor.createModule(symbol.name, currentModule.baseDir, currentModule.childrenPath, symbol.declarations?.map(decl => this.createLoC(decl, true)));
        for (const exported of (symbol.exports?.values() || [])) {
            this.addSymbol(exported, newModule);
        }
        currentModule.modules[symbol.name] = newModule;
        return [ref, newModule];
    }

    registerConstantDeclaration(symbol: ts.Symbol, type: ts.Type, decl: ts.VariableDeclaration, currentModule: Module) : [TypeReference, Declaration] {
        if (decl.initializer && type.getCallSignatures().length) return this.registerFunctionDeclaration(symbol, type, decl.initializer as ts.FunctionLikeDeclaration, currentModule);
        const ref = {
            name: symbol.name,
            path: currentModule.childrenPath,
            kind: TypeReferenceKind.Constant
        };
        this.shared.referenceCache.set(symbol, ref);
        const constDecl = {
            kind: DeclarationKind.Constant,
            name: symbol.name,
            type: this.createType(type),
            content: decl.initializer ? decl.initializer.getText().slice(0, this.settings.maxConstContentLen) : "",
            loc: this.createLoC(symbol, true),
            jsDoc: this.getJSDocData(decl)
        } satisfies ConstantDeclaration;
        currentModule.constants.push(constDecl);
        return [ref, constDecl];
    }

    registerFunctionDeclaration(symbol: ts.Symbol, type: ts.Type, decl: ts.FunctionLikeDeclaration, currentModule: Module) : [TypeReference, Declaration] {
        const ref = {
            name: symbol.name,
            path: currentModule.childrenPath,
            kind: TypeReferenceKind.Function,
        };
        this.shared.referenceCache.set(symbol, ref);
        const method = this.createMethod(symbol, [type, decl]) as Method;
        const fnDecl = {
            kind: DeclarationKind.Function,
            name: symbol.name,
            signatures: method.signatures,
            flags: method.flags,
            loc: this.createLoC(symbol, true),
            jsDoc: this.getJSDocData(decl),
        } satisfies FunctionDeclaration;
        currentModule.functions.push(fnDecl);
        return [ref, fnDecl];
    }

    registerEnumDeclaration(symbol: ts.Symbol, type: ts.Type, decl: ts.EnumDeclaration, currentModule: Module) : [TypeReference, Declaration] {
        const ref = {
            name: symbol.name,
            path: currentModule.childrenPath,
            kind: TypeReferenceKind.Enum
        };
        this.shared.referenceCache.set(symbol, ref);
        const members: EnumMember[] = [];
        for (const exportedItem of (symbol.exports?.values() || [])) {
            const [itemType, itemDecl] = this.getSymbolType<ts.EnumMember>(exportedItem);
            if (!itemType || !itemDecl) continue;
            const itemRef = {
                name: exportedItem.name,
                path: currentModule.childrenPath,
                kind: TypeReferenceKind.EnumMember,
                parent: ref
            };
            this.shared.referenceCache.set(exportedItem, itemRef);
            members.push({
                name: exportedItem.name,
                type: itemDecl.initializer ? undefined : this.createLiteralType(itemType),
                initializer: itemDecl.initializer && this.createType(this.getNodeType(itemDecl.initializer)),
                jsDoc: this.getJSDocData(itemDecl),
                loc: this.createLoC(itemDecl)
            });
        }
        const enumDecl = {
            kind: DeclarationKind.Enum,
            name: symbol.name,
            members,
            isConst: hasModifier(decl, ts.SyntaxKind.ConstKeyword),
            jsDoc: this.getJSDocData(decl),
            loc: this.createLoC(decl, true)
        } satisfies EnumDeclaration;
        currentModule.enums.push(enumDecl);
        return [ref, enumDecl];
    }

    registerTypeDeclaraction(symbol: ts.Symbol, type: ts.Type, decl: ts.TypeAliasDeclaration, currentModule: Module) : [TypeReference, Declaration] {
        const ref = {
            name: symbol.name,
            path: currentModule.childrenPath,
            kind: TypeReferenceKind.TypeAlias
        };
        this.shared.referenceCache.set(symbol, ref);
        const typeDecl = {
            kind: DeclarationKind.TypeAlias,
            name: symbol.name,
            typeParameters: mapRealValues((decl.typeParameters || []), (p) => this.createTypeParameter(this.getNodeType(p))),
            loc: this.createLoC(symbol, true),
            value: this.createType(type, undefined, true)
        } satisfies TypeAliasDeclaration;
        currentModule.types.push(typeDecl);
        return [ref, typeDecl];
    }

    registerInterfaceDeclaration(symbol: ts.Symbol, type: ts.Type, decl: ts.InterfaceDeclaration, currentModule: Module) : [TypeReference, Declaration] {
        const ref = {
            name: symbol.name,
            path: currentModule.childrenPath,
            kind: TypeReferenceKind.Interface
        };
        this.shared.referenceCache.set(symbol, ref);
        const implementsClause = [], extendsClause = [];
        for (const clause of (decl.heritageClauses || [])) {
            if (clause.token === ts.SyntaxKind.ExtendsKeyword) extendsClause.push(...clause.types.map(t => this.createType(this.shared.checker.getTypeAtLocation(t), t)));
            else if (clause.token === ts.SyntaxKind.ImplementsKeyword) implementsClause.push(...clause.types.map(t => this.createType(this.shared.checker.getTypeAtLocation(t), t)));
        }
        const interfaceDecl = {
            kind: DeclarationKind.Interface,
            name: symbol.name,
            implements: implementsClause,
            extends: extendsClause,
            typeParameters: mapRealValues((type as ts.InterfaceType).typeParameters, (p) => this.createTypeParameter(p)),
            loc: this.createLoC(symbol, true),
            otherDefs: (symbol.declarations as ts.InterfaceDeclaration[]).slice(1).map(decl => this.createLoC(decl)),
            ...this.createObjectLiteral(type, false)
        } satisfies InterfaceDeclaration;
        currentModule.interfaces.push(interfaceDecl);
        return [ref, interfaceDecl];
    }

    registerClassDeclaration(symbol: ts.Symbol, type: ts.Type, decl: ts.ClassDeclaration, currentModule: Module): [TypeReference, Declaration] {
        const ref = {
            name: symbol.name,
            path: currentModule.childrenPath,
            kind: TypeReferenceKind.Class
        };
        this.shared.referenceCache.set(symbol, ref);
        const implementsClause = [], extendsClause = [];
        
        for (const clause of (decl.heritageClauses || [])) {
            if (clause.token === ts.SyntaxKind.ExtendsKeyword) extendsClause.push(...clause.types.map(t => this.createType(this.getNodeType(t), t)));
            else if (clause.token === ts.SyntaxKind.ImplementsKeyword) implementsClause.push(...clause.types.map(t => this.createType(this.getNodeType(t), t)));
        }
        const classDecl = {
            kind: DeclarationKind.Class,
            name: symbol.name,
            implements: implementsClause,
            extends: extendsClause,
            typeParameters: mapRealValues((type as ts.InterfaceType).typeParameters, (p) => this.createTypeParameter(p)),
            isAbstract: hasModifier(decl, ts.SyntaxKind.AbstractKeyword),
            loc: this.createLoC(symbol, true),
            ...this.createObjectLiteral(type, true),
        } satisfies ClassDeclaration;

        currentModule.classes.push(classDecl);
        return [ref, classDecl];
    }

    createObjectLiteral(type: ts.Type, handleClassFlags: true) : ClassObjectLiteral;
    createObjectLiteral(type: ts.Type, handleClassFlags: false) : ObjectLiteral;
    createObjectLiteral(type: ts.Type, handleClassFlags: boolean) : ObjectLiteral | ClassObjectLiteral {
        const properties = [], methods: Method[] = [], news: Method[] = [];
        for (const property of type.getProperties()) {
            if (BitField.has(property.flags, ts.SymbolFlags.Property)) {
                const sig = this.createPropertySignature(property);
                if (sig) {
                    if (handleClassFlags) {
                        const decl = property.valueDeclaration as ts.PropertyDeclaration;
                        (sig as ClassProperty).classFlags = new BitField([hasModifier(decl, ts.SyntaxKind.PrivateKeyword) && ClassMemberFlags.Private, hasModifier(decl, ts.SyntaxKind.AbstractKeyword) && ClassMemberFlags.Abstract, hasModifier(decl, ts.SyntaxKind.StaticKeyword) && ClassMemberFlags.Static, hasModifier(decl, ts.SyntaxKind.ProtectedKeyword) && ClassMemberFlags.Protected]);
                    }
                    properties.push(sig);
                }
            } else if (BitField.has(property.flags, ts.SymbolFlags.Method)) {
                const sig = this.createMethod(property);
                if (sig) {
                    if (handleClassFlags) {
                        const decl = property.valueDeclaration as ts.PropertyDeclaration;
                        (sig as ClassMethod).classFlags = new BitField([hasModifier(decl, ts.SyntaxKind.PrivateKeyword) && ClassMemberFlags.Private, hasModifier(decl, ts.SyntaxKind.AbstractKeyword) && ClassMemberFlags.Abstract, hasModifier(decl, ts.SyntaxKind.StaticKeyword) && ClassMemberFlags.Static, hasModifier(decl, ts.SyntaxKind.ProtectedKeyword) && ClassMemberFlags.Protected]);
                    }
                    methods.push(sig);
                }
            } else if (BitField.has(property.flags, ts.SymbolFlags.Signature) && property.name === "__new") {
                const sig = this.createMethod(property);
                if (sig) news.push(sig);
            }
        }
        return { properties, methods, indexes: this.createIndexSignatures(type), new: news };
    }

    createMethod(symbol: ts.Symbol, values?: [ts.Type, ts.FunctionLikeDeclaration]) : Method | undefined {
        const [type, decl] = values || this.getSymbolType<ts.FunctionLikeDeclaration>(symbol);
        if (!type || !decl) return;
        return {
            name: symbol.name,
            computed: decl.name && ts.isComputedPropertyName(decl.name) ? this.createType(this.shared.checker.getTypeAtLocation(decl.name.expression), decl.name.expression) : undefined,
            signatures: this.createMethodSignatures(type, decl),
            flags: new BitField([decl.asteriskToken && MethodFlags.Generator, hasModifier(decl, ts.SyntaxKind.AsyncKeyword) && MethodFlags.Async])
        };
    }

    createBaseMethodSignature(signature: ts.Signature) : BaseMethodSignature {
        return {
            parameters: mapRealValues(signature.getParameters(), p => this.createParameter(p)),
            typeParameters: (signature.getTypeParameters() || []).map(p => this.createTypeParameter(p)),
            returnType: this.createType(signature.getReturnType(), signature.declaration?.type),
        };
    }

    createMethodSignatures(type: ts.Type, decl: ts.SignatureDeclaration): MethodSignature[] {
        const result: MethodSignature[] = [];
        const allSignatures = [...type.getCallSignatures()];
        if (!allSignatures.length) {
            const sig = this.shared.checker.getSignatureFromDeclaration(decl);
            if (sig) allSignatures.push(sig);
        }
        for (const signature of type.getCallSignatures()) {
            if (!signature.declaration) continue;
            result.push({
                loc: this.createLoC(signature.declaration, false),
                ...this.createBaseMethodSignature(signature)
            });
        }
        return result;
    }

    createPropertySignature(symbol: ts.Symbol) : PropertySignature | undefined {
        const [type, decl] = this.getSymbolType<ts.PropertyDeclaration>(symbol);
        if (!type || !decl) return;
        return {
            name: symbol.name,
            computed: ts.isComputedPropertyName(decl.name) ? this.createType(this.getNodeType(decl.name), decl.name) : undefined,
            type: decl.questionToken ? this.createType(this.shared.checker.getNonNullableType(type), decl.type) : this.createType(type, decl.type),
            initializer: decl.initializer ? this.createType(this.getNodeType(decl.initializer), decl.initializer) : undefined,
            flags: new BitField([decl.questionToken && PropertyFlags.Optional, decl.exclamationToken && PropertyFlags.Exclamation, hasModifier(decl, ts.SyntaxKind.ReadonlyKeyword) && PropertyFlags.Readonly]),
            jsDoc: this.getJSDocData(decl),
            loc: this.createLoC(symbol, false)
        };
    }

    createIndexSignatures(type: ts.Type) : IndexSignature[] {
        const signatures: IndexSignature[] = [];
        const stringSig = type.getStringIndexType();
        const numSig = type.getNumberIndexType();
        if (stringSig) signatures.push({
            key: "string",
            type: this.createType(stringSig)
        });
        if (numSig) signatures.push({
            key: "number",
            type: this.createType(numSig)
        });
        return signatures;
    }

    createTypeParameter(type: ts.TypeParameter): TypeParameter {
        return {
            name: type.symbol.name,
            constraint: type.constraint ? this.createType(type.constraint) : undefined,
            default: type.default ? this.createType(type.default) : undefined
        };
    }

    createParameter(symbol: ts.Symbol): FunctionParameter | undefined {
        const [type, decl] = this.getSymbolType<ts.ParameterDeclaration>(symbol);
        if (!type || !decl) return;
        return {
            name: symbol.name,
            flags: new BitField([decl.questionToken && ElementParameterFlags.Optional, decl.dotDotDotToken && ElementParameterFlags.Spread]),
            type: decl.questionToken ? this.createType(this.shared.checker.getNonNullableType(type), decl.type) : this.createType(type, decl.type),
            defaultValue: decl.initializer ? this.createType(this.getNodeType(decl.initializer), decl.initializer) : undefined,
            jsDoc: this.getJSDocData(decl)
        };
    }

    createType(t: ts.Type, node?: ts.Node, ignoreAliasSymbol?: boolean): Type {
        if (t.aliasSymbol && !ignoreAliasSymbol) {

            if (t.aliasSymbol.parent && isNamespaceSymbol(t.aliasSymbol.parent)) {
                this.addSymbol(t.aliasSymbol.parent);
            }

            const ref = this.addSymbol(t.aliasSymbol);
            if (ref) return {
                kind: TypeKind.Reference,
                type: ref,
                typeArguments: (t.aliasTypeArguments || []).map(arg => this.createType(arg))
            };
            else return this.createExternalType(t, t.aliasSymbol);
        }

        if (!t.symbol) {
            if (node && ts.isTypeReferenceNode(node)) {
                const nameSym = this.shared.checker.getSymbolAtLocation(node.typeName);
                if (!nameSym) return { kind: TypeKind.Stringified, literal: node.getText() };
                const ref = this.addSymbol(nameSym);
                if (ref) return {
                    kind: TypeKind.Reference,
                    type: ref,
                    typeArguments: (node.typeArguments || []).map(arg => this.createType(this.getNodeType(arg), arg))
                };
                else return this.createExternalType(t, nameSym);
            }
            return this.createLiteralType(t);
        }

        const ref = this.addSymbol(t.symbol);
        
        if (ref) return {
            kind: TypeKind.Reference,
            type: ref,
            typeArguments: this.shared.checker.getTypeArguments(t as ts.TypeReference).map(arg => this.createType(arg))
        };

        else if (t.isTypeParameter()) {
            return {
                kind: TypeKind.Reference,
                type: {
                    kind: TypeReferenceKind.TypeParameter,
                    name: t.symbol.name
                },
                typeArguments: this.shared.checker.getTypeArguments(t as ts.TypeReference).map(arg => this.createType(arg)),
                isInfer: ts.isInferTypeNode(getSymbolDeclaration(t.symbol)!.parent) ? true : undefined
            };
        }

        else if (BitField.has(t.flags, ts.TypeFlags.StringMapping)) {
            return {
                kind: TypeKind.Reference,
                type: {
                    kind: TypeReferenceKind.StringUtility,
                    name: t.symbol.name
                },
                typeArguments: [this.createType((t as ts.StringMappingType).type)]
            };
        }

        else if (BitField.has((t as ts.IntrinsicType).objectFlags, ts.ObjectFlags.Mapped)) {
            const mappedType = t as ts.MappedType;
            if (!mappedType.declaration.typeParameter.constraint || !mappedType.declaration.type) return NEVER_TYPE;
            return {
                kind: TypeKind.Mapped,
                readonlyToken: mappedType.declaration.readonlyToken ? mappedType.declaration.readonlyToken.kind === ts.SyntaxKind.MinusToken ? "-" : "+" : "+",
                typeParameter: mappedType.declaration.typeParameter.name.text,
                constraintType: this.createType(this.getNodeType(mappedType.declaration.typeParameter.constraint)),
                nameType: mappedType.declaration.nameType && this.createType(this.getNodeType(mappedType.declaration.nameType)),
                type: this.createType(this.getNodeType(mappedType.declaration.type))
            };
        }

        else if (BitField.has(t.symbol.flags, ts.SymbolFlags.TypeLiteral) || BitField.has(t.symbol.flags, ts.SymbolFlags.ObjectLiteral)) {
            const signature = t.getCallSignatures()[0];
            if (signature) return {
                kind: TypeKind.ArrowFunction,
                ...this.createBaseMethodSignature(signature)
            };
            else return {
                kind: TypeKind.ObjectLiteral,
                ...this.createObjectLiteral(t, false)
            };
        }

        return this.createExternalType(t, t.symbol);
    }

    createExternalType(type: ts.Type, typeSymbol: ts.Symbol) : Type {
        const createRef = (libName: string, rest: string[]): ReferenceType => {
            const ref = { name: typeSymbol.name, kind: TypeReferenceKind.Unknown, link: this.shared.hooks.trigger("resolveExternalLink", this, typeSymbol, getSymbolTypeKind(typeSymbol), libName, rest) };
            this.shared.referenceCache.set(typeSymbol, ref);
            const typeArguments = this.shared.checker.getTypeArguments(type as ts.TypeReference).map(arg => this.createType(arg));
            return { kind: TypeKind.Reference, typeArguments, type: ref };
        };

        if (!this.shared.hooks.has("resolveExternalLink")) return createRef("", []);

        const decl = getSymbolDeclaration(typeSymbol);
        if (!decl) return createRef("", []);

        const declSource = decl.getSourceFile();
        if (!declSource.isDeclarationFile) {
            let importSpecifier;
            if (ts.isNamespaceImport(decl)) importSpecifier = (decl.parent.parent.moduleSpecifier as ts.StringLiteral).text;
            else if (ts.isImportClause(decl)) importSpecifier = (decl.parent.moduleSpecifier as ts.StringLiteral).text;
            else if (ts.isImportSpecifier(decl)) importSpecifier = (decl.parent.parent.parent.moduleSpecifier as ts.StringLiteral).text;
            else return createRef("", []);

            const splitPath = importSpecifier.split("/");
            const [libName, rest] = splitPath[0][0] === "@" ? [splitPath[0] + "/" + splitPath[1], splitPath.slice(2)] : [splitPath[0], splitPath.slice(1)];
            return createRef(libName, rest);
        }
        else {
            const path = declSource.fileName.slice(declSource.fileName.indexOf(this.settings.moduleStorage + "/") + this.settings.moduleStorage.length + 1).split("/");
            const [libName, rest] = path[0][0] === "@" ? [path[0] + "/" + path[1], path.slice(2)] : [path[0], path.slice(1)];
            return createRef(libName, rest);
        }
    }

    createLiteralType(t: ts.Type) : Type {
        if (BitField.has(t.flags, ts.TypeFlags.Unknown)) return { kind: TypeKind.Unknown };
        else if (BitField.has(t.flags, ts.TypeFlags.Any)) return { kind: TypeKind.Any };
        else if (BitField.has(t.flags, ts.TypeFlags.Never)) return NEVER_TYPE;
        else if (BitField.has(t.flags, ts.TypeFlags.Void)) return { kind: TypeKind.Void };
        else if (BitField.has(t.flags, ts.TypeFlags.Undefined)) return { kind: TypeKind.Undefined };
        else if (BitField.has(t.flags, ts.TypeFlags.Null)) return { kind: TypeKind.Null };
        else if (t === this.shared.checker.getStringType()) return { kind: TypeKind.String };
        else if (t === this.shared.checker.getNumberType()) return { kind: TypeKind.Number };
        else if (t.isStringLiteral()) return { kind: TypeKind.String, literal: t.value };
        else if (t.isNumberLiteral()) return { kind: TypeKind.Number, literal: t.value.toString() };
        else if (t === this.shared.checker.getFalseType()) return { kind: TypeKind.Boolean, literal: "false" };
        else if (t === this.shared.checker.getTrueType()) return { kind: TypeKind.Boolean, literal: "true" };
        else if (t === this.shared.checker.getBooleanType()) return { kind: TypeKind.Boolean };
        else if (t.isUnion()) return { kind: TypeKind.Union, types: t.types.map(t => this.createType(t)) };
        else if (t.isIntersection()) return { kind: TypeKind.Intersection, types: t.types.map(t => this.createType(t)) };
        else if (this.shared.checker.isTupleType(t)) {
            const typeArguments = this.shared.checker.getTypeArguments(t as ts.TypeReference);
            const tupleType = (t as ts.TypeReference).target as ts.TupleType;
            return {
                kind: TypeKind.Tuple,
                types: typeArguments.map((arg, ind) => {
                    const flags = new BitField([]);
                    let name;
                    const currentElement = tupleType.labeledElementDeclarations?.[ind];
                    if (currentElement) {
                        name = currentElement.name.getText();
                        flags.set(currentElement.questionToken && ElementParameterFlags.Optional, currentElement.dotDotDotToken && ElementParameterFlags.Spread);
                    }
                    return {
                        name,
                        flags,
                        type: this.createType(name && flags.has(ElementParameterFlags.Optional) ? this.shared.checker.getNonNullableType(arg) : arg)
                    };
                })
            };
        }
        else if (BitField.has(t.flags, ts.TypeFlags.Conditional)) {
            const condType = t as ts.ConditionalType;
            return {
                kind: TypeKind.Conditional,
                checkType: this.createType(condType.checkType),
                extendsType: this.createType(condType.extendsType), 
                ifTrue: this.createType(this.getNodeType(condType.root.node.trueType)),
                ifFalse: this.createType(this.getNodeType(condType.root.node.falseType)),
            };
        }
        else if (BitField.has(t.flags, ts.TypeFlags.IndexedAccess)) {
            const indexedType = t as ts.IndexedAccessType;
            return {
                kind: TypeKind.IndexAccess,
                index: this.createType(indexedType.indexType),
                type: this.createType(indexedType.objectType)
            };
        }
        else if (BitField.has(t.flags, ts.TypeFlags.Index)) {
            const indexType = t as ts.IndexType;
            return {
                kind: TypeKind.TypeOperator,
                operator: "keyof",
                type: this.createType(indexType.type)
            };
        }
        else if (BitField.has(t.flags, ts.TypeFlags.TemplateLiteral)) {
            const litType = t as ts.TemplateLiteralType;
            return {
                kind: TypeKind.TemplateLiteral,
                text: [...litType.texts],
                types: litType.types.map(t => this.createType(t))
            };
        }
        else return { kind: TypeKind.Reference, type: { name: this.shared.checker.typeToString(t), kind: TypeReferenceKind.Unknown }};
    }

    createLoC(symbol: ts.Symbol | ts.Node, includeSourceFile?: boolean): LoC {
        const decl = ("name" in symbol && typeof symbol.name === "string") ? getSymbolDeclaration(symbol) : (symbol as ts.Node);
        if (!decl) throw "Expected variable declaration.";
        const source = decl.getSourceFile();
        return {
            pos: source.getLineAndCharacterOfPosition(decl.getStart()),
            sourceFile: includeSourceFile ? source.fileName.slice(this.module.baseDir.length) : undefined
        };
    }

    getJSDocData(node: ts.Node): JSDocData | undefined {
        const data = ts.getJSDocCommentsAndTags(node);
        if (!data.length) return;
        const result = { tags: [] as JSDocTag[], comment: [] as string[] } satisfies JSDocData;
        for (const comment of data) {
            if (comment.comment) result.comment.push(comment.comment as string);
            for (const tag of ((comment as ts.JSDoc).tags || [])) {
                let arg, type;
                if (ts.isJSDocParameterTag(tag) && ts.isIdentifier(tag.name)) {
                    arg = tag.name.text;
                    type = tag.typeExpression ? this.createType(this.getNodeType(tag.typeExpression), tag.typeExpression) : undefined;
                }
                result.tags.push({
                    name: tag.tagName.text,
                    comment: tag.comment as string,
                    arg,
                    type
                });
            }
        }
        return result;
    }

    getNodeType(node: ts.Node): ts.Type {
        const type = this.shared.checker.getTypeAtLocation(node);
        if (!type) throw new Error("Expected type.");
        return type;
    }

    getSymbolType<T extends ts.Declaration = ts.Declaration>(symbol: ts.Symbol): [ts.Type | undefined, T | undefined] {
        const node = getSymbolDeclaration(symbol);
        if (!node) return [undefined, undefined];
        let type = this.shared.checker.getDeclaredTypeOfSymbol(symbol);
        if ((type as ts.IntrinsicType).intrinsicName === "error") type = this.shared.checker.getTypeOfSymbol(symbol); 
        return [type, node as T];
    }

    resolveAliasSymbol(symbol: ts.Symbol) : ts.Symbol {
        while (BitField.has(symbol.flags, ts.SymbolFlags.Alias)) {
            const newSym = this.shared.checker.getAliasedSymbol(symbol);
            if (newSym.name === "unknown") return symbol;
            symbol = newSym;
        }
        return symbol;
    }

    getOrCreateChildModule(source: string): Module {
        const { dir } = path.parse(source);
        if (this.shared.moduleCache[dir]) return this.shared.moduleCache[dir];
        const baseDirIndex = dir.indexOf(this.module.baseDir);
        if (baseDirIndex !== 0 || dir.length === this.module.baseDir.length) {
            this.shared.moduleCache[source] = this.module;
            return this.module;
        }

        const realPath = dir.slice(this.module.baseDir.length);
        const pathParts = realPath.split("/");

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let lastModule: Module = this.module;
        const newPath = [this.module.name];

        for (let i = 0; i < pathParts.length; i++) {
            const pathPart = pathParts[i];
            if (pathPart === "" || this.settings.passthroughModules?.includes(pathPart)) continue;
            const currentModule = lastModule.modules[pathPart];
            if (!currentModule) {
                const newModule = TypescriptExtractor.createModule(pathPart, joinPartOfArray(pathParts, i, "/"), [...newPath]);
                lastModule.modules[pathPart] = newModule;
                lastModule = newModule;
            }
            else lastModule = currentModule;
            newPath.push(pathPart);
        }

        this.shared.moduleCache[dir] = lastModule;
        return lastModule;
    }

    getRepositoryURLForNode(node: BaseNode, parentNode?: Declaration): string | undefined {
        if (!this.packageJSON || !this.packageJSON.repositoryBase) return;
        const source = node.loc.sourceFile || parentNode?.loc.sourceFile;
        if (!source) return;
        return path.join(this.packageJSON.repositoryBase, `${source}#L${node.loc.pos.line + 1}`);
    }

    addExtra(item: BaseNode, key: string, extra: unknown) : void {
        if (!item.extras) item.extras = { [key]: extra };
        else item.extras[key] = extra;
    }

    getExtra<T>(item: BaseNode, key: string) : T | undefined {
        return item.extras?.[key] as T;
    }

    toJSON() : Record<string, unknown> {
        return {
            module: this.module,
            packageJSON: this.packageJSON
        };
    }

    static createModule(name: string, baseDir: string, path: ItemPath, namespace?: LoC[]): Module {
        return {
            name,
            path,
            childrenPath: [...path, name],
            baseDir,
            namespace,
            modules: {},
            classes: [],
            interfaces: [],
            types: [],
            enums: [],
            functions: [],
            constants: [],
            exports: {},
            reference: {
                name,
                path,
                kind: TypeReferenceKind.Module
            }
        };
    }

    static createSettings(settings: Partial<TypescriptExtractorSettings>) : TypescriptExtractorSettings {
        return {
            passthroughModules: settings.passthroughModules,
            moduleStorage: settings.moduleStorage || "node_modules",
            maxConstContentLen: settings.maxConstContentLen || 512
        };
    }

}
