import ts from "typescript";
import { TypescriptExtractorSettings, TypescriptExtractor, Shared, TypescriptProjectDetails, TypescriptExtractorHooks } from "./extractor";
import { getAbsolutePath, getFileNameFromPath, getPackageJSON, getTsconfig, resolvePackageName, tryGetMainFile } from "./utils";
import { HookManager } from "./hookManager";
import path from "path";

export interface TypescriptExtractorEntry {
    /**
     * The path to the **root** of the project. The root is the
     * directory which contains the project's `package.json` and
     * `tsconfig.json` files.
     */
    path: string,
    /**
     * The main file of the project. The main file of a project is the
     * file that gets loaded automatically when you import your project
     * without any extra paths:
     * 
     * ```ts
     * import Stuff from "my-project";
     * ```
     * 
     * If not provided, the extractor will attempt to find it based on
     * the `main` property in the `package.json` file and the `rootDir`
     * property from the `tsconfig.json` file. To learn more about this,
     * check out the [[tryGetMainFile]] function.
     */
    mainFile?: string,
    settings?: TypescriptExtractorSettings
}

export interface TypescriptExtractorGroupSettings {
    entries: TypescriptExtractorEntry[],
    hooks?: HookManager<TypescriptExtractorHooks>,
    passthroughModules?: string[],
    gitBranch?: string,
    cwd?: string
}

export interface TypescriptExtractorGroupResult {
    extractors: TypescriptExtractor[],
    shared: Shared,
    notFound: string[]
}

export function getExtractorDetails(groupSettings: TypescriptExtractorGroupSettings, entry: TypescriptExtractorEntry) : TypescriptProjectDetails | undefined {
    const realPath = groupSettings.cwd ? ts.normalizeSlashes(path.join(groupSettings.cwd, entry.path)) : entry.path;
    const tsconfig = getTsconfig(realPath);
    if (!tsconfig) return;
    const packageJSON = getPackageJSON(realPath);
    const absolutePath = getAbsolutePath(realPath);
    const name = packageJSON?.name ? resolvePackageName(packageJSON.name) : getFileNameFromPath(absolutePath);
    const mainFile = entry.mainFile ? ts.normalizeSlashes(path.join(absolutePath, entry.mainFile)) : tryGetMainFile(absolutePath, tsconfig.options, packageJSON);
    if (!mainFile) return;
    const settings = TypescriptExtractor.createSettings({...groupSettings, ...(entry.settings || {})});
    return { tsconfig, packageJSON, name, settings, absolutePath, basePath: realPath, mainFile };
}

export function createExtractorGroupHost(extractors: Record<string, TypescriptProjectDetails>, options: ts.CompilerOptions) : ts.CompilerHost {
    const defaultHost = ts.createCompilerHost(options, true);
    defaultHost.resolveModuleNameLiterals = (moduleLiterals, containingFile) => {
        const res: ts.ResolvedModuleWithFailedLookupLocations[] = [];
        for (const lit of moduleLiterals) {
            if (lit.text[0] === "." || lit.text[1] === "/") res.push(ts.resolveModuleName(lit.text, containingFile, options, {fileExists: defaultHost.fileExists, readFile: defaultHost.readFile}));
            else {
                const nameWithPossiblyPath = resolvePackageName(lit.text);
                let name = "", pathToFile = "";
                const maybeSlash = nameWithPossiblyPath.indexOf("/");
                if (maybeSlash !== -1) {
                    name = nameWithPossiblyPath.slice(0, maybeSlash);
                    pathToFile = nameWithPossiblyPath + ".ts";
                } else {
                    name = nameWithPossiblyPath;
                }
                if (extractors[name]) {
                    const details = extractors[name];
                    const finalPath = pathToFile ? ts.normalizePath(path.join(details.absolutePath, pathToFile)) : details.mainFile;
                    res.push({
                        resolvedModule: {
                            resolvedFileName: finalPath,
                            extension: ts.Extension.Ts,
                            isExternalLibraryImport: false
                        }
                    });
                }
                else res.push(ts.resolveModuleName(lit.text, containingFile, options, {fileExists: defaultHost.fileExists, readFile: defaultHost.readFile}));
            }
        }
        return res;
    };
    return defaultHost;
}

export function createExtractorGroup(settings: TypescriptExtractorGroupSettings) : TypescriptExtractorGroupResult {
    const notFound = [];
    const extractorDetails: Record<string, TypescriptProjectDetails> = {};
    const extractorFiles = [];
    for (const entry of settings.entries) {
        const details = getExtractorDetails(settings, entry);
        if (!details) notFound.push(entry.path);
        else {
            extractorFiles.push(...details.tsconfig.fileNames);
            extractorDetails[details.name] = details;
        }
    }

    const compilerOptions = ts.getDefaultCompilerOptions();

    const program = ts.createProgram({
        rootNames: extractorFiles,
        options: compilerOptions,
        host: createExtractorGroupHost(extractorDetails, compilerOptions)
    });

    const shared: Shared = {
        program,
        checker: program.getTypeChecker(),
        referenceCache: new Map(),
        moduleCache: {},
        hooks: settings.hooks || new HookManager<TypescriptExtractorHooks>()
    };

    const extractors = [];
    for (const details of Object.values(extractorDetails)) {
        const extractor = new TypescriptExtractor(details, shared);
        extractor.collect();
        extractors.push(extractor);
    }

    return {
        extractors,
        notFound,
        shared
    };
}

export * from "./extractor";
export * as Utils from "./utils";