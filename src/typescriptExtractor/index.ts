import ts from "typescript";
import { TypescriptExtractorSettings, TypescriptExtractor, Shared, TypescriptProjectDetails, TypescriptExtractorHooks } from "./extractor";
import { getAbsolutePath, getFileNameFromPath, getPackageJSON, getTsconfig, resolvePackageName } from "./utils";
import { HookManager } from "./hookManager";
import path from "path";

export interface TypescriptExtractorEntry {
    path: string,
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
    const realPath = groupSettings.cwd ? path.join(groupSettings.cwd, entry.path).replace(path.sep, "/") : entry.path;
    const tsconfig = getTsconfig(realPath);
    if (!tsconfig) return;
    const packageJSON = getPackageJSON(realPath);
    const absolutePath = getAbsolutePath(realPath);
    const name = packageJSON?.name ? resolvePackageName(packageJSON.name) : getFileNameFromPath(absolutePath);
    const settings = TypescriptExtractor.createSettings({...groupSettings, ...(entry.settings || {})});
    return { tsconfig, packageJSON, name, settings, absolutePath, basePath: realPath };
}

export function createExtractorGroup(settings: TypescriptExtractorGroupSettings) : TypescriptExtractorGroupResult {
    const notFound = [];
    const extractorDetails = [];
    const extractorRemaps: Record<string, string[]> = {};
    const extractorFiles = [];
    for (const entry of settings.entries) {
        const details = getExtractorDetails(settings, entry);
        if (!details) notFound.push(entry.path);
        else {
            extractorDetails.push(details);
            extractorFiles.push(...details.tsconfig.fileNames);
            extractorRemaps[`${details.name}/*`] = [`./${details.basePath}/*`];
        }
    }

    const program = ts.createProgram({
        rootNames: extractorFiles,
        options: { ...ts.getDefaultCompilerOptions(), paths: extractorRemaps, baseUrl: "./" }
    });

    console.log({ ...ts.getDefaultCompilerOptions(), paths: extractorRemaps, baseUrl: settings.cwd || "./" });

    const shared: Shared = {
        program,
        checker: program.getTypeChecker(),
        referenceCache: new Map(),
        moduleCache: {},
        hooks: settings.hooks || new HookManager<TypescriptExtractorHooks>()
    };

    const extractors = [];
    for (const details of extractorDetails) {
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