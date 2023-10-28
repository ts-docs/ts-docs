import * as ts from "typescript";
import * as path from "path";
import { ClassDeclaration, ItemPath, LoC, Module, Node, PropertySignature, TypeReference, TypeReferenceKind } from "./structure";
import { PackageJSON, getPackageJSON, getTsconfig, joinPartOfArray, resolvePackageName } from "./utils";

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
    ref: TypeReference;
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
        this.ref = TypescriptExtractor.createReference(this);

        for (const fileName of tsConfig.fileNames) {
            //const file = shared.program.getSourceFile(fileName);
            console.log(fileName);
            this.getOrCreateChildModule(fileName);
        }
    }

    addSymbol(symbol: ts.Symbol) {
        
    }

    addClassDeclaration(symbol: ts.Symbol) : void {

    }

    createSignature(symbol: ts.Symbol) : Signature | undefined {
        const node = symbol.valueDeclaration;
        if (!node) return;
        const type = this.shared.checker.getTypeOfSymbolAtLocation(symbol, node);
        if (!type) return;
        
    }

    getOrCreateChildModule(source: string) : Module {
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

        for (let i=0; i < pathParts.length; i++) {
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

    getRepositoryURLForNode(node: Node) : string | undefined {
        if (!this.packageJSON || !this.packageJSON.repositoryBase) return;
        return path.join(this.packageJSON.repositoryBase, node.loc.sourceFile);
    }

    static createExtractor(basePath: string, shared: Shared) : TypescriptExtractor | undefined {
        const config = getTsconfig(basePath);
        if (!config) return;
        return new TypescriptExtractor(basePath, config, shared);
    }

    static createModule(name: string, baseDir: string, path: ItemPath, namespace?: LoC[]) : Module {
        return {
            name,
            path,
            baseDir,
            namespace,
            modules: new Map(),
            classes: [],
            ref: {
                name,
                path,
                kind: TypeReferenceKind.Module
            }
        };
    }

    static createReference(module: Module) : TypeReference {
        return {
            name: module.name,
            path: module.path,
            kind: TypeReferenceKind.Module
        };
    }

    static createStandaloneExtractor(basePath: string, settings: TypescriptExtractorSettings = {}) : TypescriptExtractor | undefined {
        const config = getTsconfig(basePath);
        if (!config) return;
        const program = ts.createProgram({
            rootNames: config.fileNames,
            options: config.options,
            configFileParsingDiagnostics: config.errors
        });
        const checker = program.getTypeChecker();
        return new TypescriptExtractor(basePath, config, { program, checker, settings, moduleCache: {}});
    }

}
