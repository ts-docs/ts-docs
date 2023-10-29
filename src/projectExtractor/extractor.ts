import * as ts from "typescript";
import * as path from "path";
import { BaseNode, ClassDeclaration, ClassMemberFlags, ClassMethod, ClassObjectLiteral, ClassProperty, Declaration, DeclarationKind, FunctionParameter, FunctionParameterFlags, IndexSignature, ItemPath, JSDocData, JSDocTag, LoC, Method, MethodFlags, MethodSignature, Module, ObjectLiteral, PropertyFlags, PropertySignature, Type, TypeKind, TypeParameter, TypeReference, TypeReferenceKind } from "./structure";
import { BitField, PackageJSON, getPackageJSON, getTsconfig, hasModifier, joinPartOfArray, mapRealValues, resolvePackageName } from "./utils";

export interface TypescriptExtractorSettings {
    /**
     * Any provided folder names won't count as modules, items inside will be included in the parent module.
     */
    passthroughModules?: string[]
}

export interface Shared {
    program: ts.Program,
    checker: ts.TypeChecker,
    moduleCache: Record<string, Module>,
    referenceCache: Map<ts.Symbol, TypeReference>,
    settings: TypescriptExtractorSettings
}

/**
 * Extracts modules from a single typescript project.
 */
export class TypescriptExtractor implements Module {
    name: string;
    baseDir: string;
    modules: Map<string, Module>;
    classes: ClassDeclaration[];
    path: ItemPath;
    packageJSON?: PackageJSON;
    shared: Shared;
    constructor(basePath: string, tsConfig: ts.ParsedCommandLine, shared: Shared) {
        this.baseDir = basePath;
        this.shared = shared;
        this.modules = new Map();
        this.classes = [];
        this.path = [];
        this.packageJSON = getPackageJSON(basePath);
        this.name = this.packageJSON?.name ? resolvePackageName(this.packageJSON.name) : basePath.slice(basePath.lastIndexOf(path.sep) + 1);

        for (const fileName of tsConfig.fileNames) {
            const fileObject = this.shared.program.getSourceFile(fileName);
            if (!fileObject || fileObject.isDeclarationFile) continue;
            const fileSymbol = this.shared.checker.getSymbolAtLocation(fileObject);
            if (!fileSymbol) continue;
            const module = this.getOrCreateChildModule(fileName);
            for (const exportedSym of (fileSymbol.exports?.values() || [])) {
                this.addSymbol(exportedSym, module);
            }
        }

    }

    addSymbol(symbol: ts.Symbol, currentModule?: Module) : TypeReference | undefined {
        if (!currentModule) {
            if (!symbol.valueDeclaration) return;
            const file = symbol.valueDeclaration.getSourceFile();
            if (file.isDeclarationFile) return;
            currentModule = this.getOrCreateChildModule(file.fileName);
        }

        if (this.shared.referenceCache.has(symbol)) return this.shared.referenceCache.get(symbol);
        else if (BitField.has(symbol.flags, ts.SymbolFlags.Class)) return this.registerClassDeclaration(symbol, currentModule);
        return;
    }

    registerClassDeclaration(symbol: ts.Symbol, currentModule: Module): TypeReference | undefined {
        const [type, decl] = this.getSymbolType<ts.ClassDeclaration>(symbol);
        if (!type || !decl) return;

        const ref = {
            name: symbol.name,
            path: currentModule.path,
            kind: TypeReferenceKind.Class
        };

        this.shared.referenceCache.set(symbol, ref);

        const implementsClause = [], extendsClause = [];
        
        for (const clause of (decl.heritageClauses || [])) {
            if (clause.token === ts.SyntaxKind.ExtendsKeyword) extendsClause.push(...clause.types.map(t => this.createType(this.shared.checker.getTypeAtLocation(t))));
            else if (clause.token === ts.SyntaxKind.ImplementsKeyword) implementsClause.push(...clause.types.map(t => this.createType(this.shared.checker.getTypeAtLocation(t))));
        }

        const classDecl: ClassDeclaration = {
            kind: DeclarationKind.Class,
            name: symbol.name,
            implements: implementsClause,
            extends: extendsClause,
            typeParameters: mapRealValues((type as ts.InterfaceType).typeParameters, (p) => this.createTypeParameter(p)),
            isAbstract: hasModifier(decl, ts.SyntaxKind.AbstractKeyword),
            loc: this.createLoC(symbol, true),
            ...this.createObjectLiteral(type, true),
        };

        currentModule.classes.push(classDecl);
        return ref;
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

    createMethod(symbol: ts.Symbol) : Method | undefined {
        const [type, decl] = this.getSymbolType<ts.MethodDeclaration>(symbol);
        if (!type || !decl) return;
        return {
            name: symbol.name,
            computed: ts.isComputedPropertyName(decl.name) ? this.createType(this.shared.checker.getTypeAtLocation(decl.name.expression)) : undefined,
            signatures: this.createMethodSignatures(type, decl),
            flags: new BitField([decl.asteriskToken && MethodFlags.Generator, hasModifier(decl, ts.SyntaxKind.AsyncKeyword) && MethodFlags.Async])
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
                parameters: mapRealValues(signature.getParameters(), p => this.createParameter(p)),
                typeParameters: (signature.getTypeParameters() || []).map(p => this.createTypeParameter(p)),
                returnType: this.createType(signature.getReturnType()),
                loc: this.createLoC(signature.declaration, false)
            });
        }
        return result;
    }

    createPropertySignature(symbol: ts.Symbol) : PropertySignature | undefined {
        const [type, decl] = this.getSymbolType<ts.PropertyDeclaration>(symbol);
        if (!type || !decl) return;
        return {
            name: symbol.name,
            computed: ts.isComputedPropertyName(decl.name) ? this.createType(this.shared.checker.getTypeAtLocation(decl.name.expression)) : undefined,
            type: decl.questionToken ? this.createType(this.shared.checker.getNonNullableType(type)) : this.createType(type),
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
            flags: new BitField([decl.questionToken && FunctionParameterFlags.Optional, decl.dotDotDotToken && FunctionParameterFlags.Spread]),
            type: decl.questionToken ? this.createType(this.shared.checker.getNonNullableType(type)) : this.createType(type),
            defaultValue: decl.initializer ? this.createType(this.getNodeType(decl.initializer)) : undefined,
            jsDoc: this.getJSDocData(decl)
        };
    }

    createType(t: ts.Type): Type {
        if (!t.symbol) return { kind: TypeKind.Reference, type: { name: "unknown", path: [], kind: TypeReferenceKind.External }};
        const ref = this.addSymbol(t.symbol);

        console.log(t.symbol.name, ref);
        
        if (ref) return {
            kind: TypeKind.Reference,
            type: ref,
            typeArguments: this.shared.checker.getTypeArguments(t as ts.TypeReference).map(arg => this.createType(arg))
        };

        return {
            kind: TypeKind.Reference,
            type: { 
                name: t.symbol.name, 
                path: [], 
                kind: TypeReferenceKind.External
            },
            typeArguments: this.shared.checker.getTypeArguments(t as ts.TypeReference).map(arg => this.createType(arg))
        };
    }

    createLoC(symbol: ts.Symbol | ts.Node, includeSourceFile?: boolean): LoC {
        const decl = ("name" in symbol && typeof symbol.name === "string") ? symbol.valueDeclaration : (symbol as ts.Node);
        if (!decl) throw "Expected variable declaration.";
        const source = decl.getSourceFile();
        return {
            pos: source.getLineAndCharacterOfPosition(decl.getStart()),
            sourceFile: includeSourceFile ? source.fileName.slice(this.baseDir.length) : undefined
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
                    type = tag.typeExpression ? this.createType(this.getNodeType(tag.typeExpression)) : undefined;
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
        const node = symbol.valueDeclaration;
        if (!node) return [undefined, undefined];
        let type = this.shared.checker.getDeclaredTypeOfSymbol(symbol);
        if ((type as ts.IntrinsicType).intrinsicName === "error") type = this.shared.checker.getTypeOfSymbol(symbol); 
        return [type, node as T];
    }

    getOrCreateChildModule(source: string): Module {
        const { dir } = path.parse(source);
        if (this.shared.moduleCache[dir]) return this.shared.moduleCache[dir];
        const baseDirIndex = dir.indexOf(this.baseDir);
        if (baseDirIndex !== 0 || dir.length === this.baseDir.length) {
            this.shared.moduleCache[source] = this;
            return this;
        }

        const realPath = dir.slice(this.baseDir.length);
        const pathParts = realPath.split("/");

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let lastModule: Module = this;
        const newPath = [];

        for (let i = 0; i < pathParts.length; i++) {
            const pathPart = pathParts[i];
            if (pathPart === "" || this.shared.settings.passthroughModules?.includes(pathPart)) continue;
            const currentModule = lastModule.modules.get(pathPart);
            if (!currentModule) {
                const newModule = TypescriptExtractor.createModule(pathPart, joinPartOfArray(pathParts, i, "/"), [...this.path, ...newPath]);
                lastModule.modules.set(pathPart, newModule);
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

    toJSON() : Record<string, unknown> {
        return {
            name: this.name,
            baseDir: this.baseDir,
            modules: [...this.modules.values()],
            classes: this.classes,
            path: this.path,
            packageJSON: this.packageJSON
        };
    }

    static createExtractor(basePath: string, shared: Shared): TypescriptExtractor | undefined {
        const config = getTsconfig(basePath);
        if (!config) return;
        return new TypescriptExtractor(basePath, config, shared);
    }

    static createModule(name: string, baseDir: string, path: ItemPath, namespace?: LoC[]): Module {
        return {
            name,
            path,
            baseDir,
            namespace,
            modules: new Map(),
            classes: []
        };
    }

    static createModuleReference(module: Module): TypeReference {
        return {
            name: module.name,
            path: module.path,
            kind: TypeReferenceKind.Module
        };
    }

    static createStandaloneExtractor(basePath: string, settings: TypescriptExtractorSettings = {}): TypescriptExtractor | undefined {
        const config = getTsconfig(basePath);
        if (!config) return;
        const program = ts.createProgram({
            rootNames: config.fileNames,
            options: config.options,
            configFileParsingDiagnostics: config.errors
        });
        const checker = program.getTypeChecker();
        return new TypescriptExtractor(basePath, config, { program, checker, settings, moduleCache: {}, referenceCache: new Map() });
    }

}
