import * as ts from "typescript";
import * as path from "path";
import { BaseNode, ClassDeclaration, Declaration, DeclarationKind, FunctionParameter, FunctionParameterFlags, IndexSignature, ItemPath, JSDocData, JSDocTag, LoC, Method, MethodFlags, MethodSignature, Module, ObjectLiteral, PropertyFlags, PropertySignature, Type, TypeKind, TypeParameter, TypeReference, TypeReferenceKind } from "./structure";
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
            if (!fileObject) continue;
            const fileSymbol = this.shared.checker.getSymbolAtLocation(fileObject);
            if (!fileSymbol) continue;
            const module = this.getOrCreateChildModule(fileName);
            for (const exportedSym of (fileSymbol.exports?.values() || [])) {
                this.addSymbol(exportedSym, module);
            }
        }

    }

    addSymbol(symbol: ts.Symbol, currentModule: Module) {
        if (BitField.has(symbol.flags, ts.SymbolFlags.Class)) this.registerClassDeclaration(symbol, currentModule);
    }

    registerClassDeclaration(symbol: ts.Symbol, currentModule: Module): void {
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
            loc: this.createLoC(symbol, currentModule, true),
            ...this.createObjectLiteral(symbol, currentModule),
        };

        currentModule.classes.push(classDecl);
    }

    createObjectLiteral(type: ts.Symbol, currentModule: Module) : ObjectLiteral {
        const properties = [], methods: Method[] = [], indexes = [], news: Method[] = [];
        for (const property of (type.members?.values() || [])) {
            if (BitField.has(property.flags, ts.SymbolFlags.Property)) {
                const sig = this.createPropertySignature(property, currentModule);
                if (sig) properties.push(sig);
            } else if (BitField.has(property.flags, ts.SymbolFlags.Method)) {
                const sig = this.createMethod(property, currentModule);
                if (sig) methods.push(sig);
            } else if (BitField.has(property.flags, ts.SymbolFlags.Signature)) {
                if (property.name === "__index") {
                    const indSig = this.createIndexSignature(property, currentModule);
                    if (indSig) indexes.push(indSig);
                }
                else if (property.name === "__new") {
                    const sig = this.createMethod(property, currentModule);
                    if (sig) news.push(sig);
                }
            }
        }
        return { properties, methods, indexes, new: news };
    }

    createMethod(symbol: ts.Symbol, currentModule: Module) : Method | undefined {
        const [type, decl] = this.getSymbolType<ts.MethodDeclaration>(symbol);
        if (!type || !decl) return;
        return {
            name: symbol.name,
            signatures: this.createMethodSignatures(type, decl, currentModule),
            flags: new BitField([decl.asteriskToken && MethodFlags.Generator, hasModifier(decl, ts.SyntaxKind.AsyncKeyword) && MethodFlags.Async])
        };
    }

    createMethodSignatures(type: ts.Type, decl: ts.SignatureDeclaration, currentModule: Module): MethodSignature[] {
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
                loc: this.createLoC(signature.declaration, currentModule, false)
            });
        }
        return result;
    }

    createPropertySignature(symbol: ts.Symbol, currentModule: Module) : PropertySignature | undefined {
        const [type, decl] = this.getSymbolType<ts.PropertyDeclaration>(symbol);
        if (!type || !decl) return;
        return {
            name: symbol.name,
            computed: symbol.name === "__computed" ? this.createType(this.shared.checker.getTypeAtLocation(decl.name)) : undefined,
            type: decl.questionToken ? this.createType(this.shared.checker.getNonNullableType(type)) : this.createType(type),
            flags: new BitField([decl.questionToken && PropertyFlags.Optional, decl.exclamationToken && PropertyFlags.Exclamation, hasModifier(decl, ts.SyntaxKind.ReadonlyKeyword) && PropertyFlags.Readonly]),
            jsDoc: this.getJSDocData(decl),
            loc: this.createLoC(symbol, currentModule, false)
        };
    }

    createIndexSignature(symbol: ts.Symbol, currentModule: Module) : IndexSignature | undefined {
        const [, decl] = this.getSymbolType<ts.IndexSignatureDeclaration>(symbol);
        if (!decl) return;
        return {
            key: this.createType(this.shared.checker.getTypeAtLocation(decl.parameters[0])),
            type: this.createType(this.shared.checker.getTypeAtLocation(decl.type)),
            jsDoc: this.getJSDocData(decl),
            loc: this.createLoC(symbol, currentModule, false)
        };
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

    createLoC(symbol: ts.Symbol | ts.Node, currentModule: Module, includeSourceFile?: boolean): LoC {
        const decl = ("name" in symbol && typeof symbol.name === "string") ? symbol.valueDeclaration : (symbol as ts.Node);
        if (!decl) throw "Expected variable declaration.";
        const source = decl.getSourceFile();
        return {
            pos: ts.getLineAndCharacterOfPosition(source, decl.pos),
            sourceFile: includeSourceFile ? path.join(currentModule.baseDir, path.parse(source.fileName).name) : undefined
        };
    }

    createType(t: ts.Type): Type {
        if (!t.symbol) return { kind: TypeKind.Reference, type: { name: "unknown", path: [], kind: TypeReferenceKind.External }};
        return {
            kind: TypeKind.Reference,
            type: { name: t.symbol.name, path: [], kind: TypeReferenceKind.Class }
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
        const type = this.shared.checker.getTypeOfSymbol(symbol);
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
