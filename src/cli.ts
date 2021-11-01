#!/usr/bin/env node

import parseArgs from "minimist";
import { TypescriptExtractor } from "@ts-docs/extractor";
import { setupDocumentStructure } from "./documentStructure";
import { Generator } from "./generator";
import { findTSConfig, findTsDocsJs, handleDefaultAPI, handleNodeAPI } from "./utils";
import { addOptionSource, initOptions, options, OptionSource, showHelp, initConfig } from "./options";
import { renderBranches } from "./branches";
import fs from "fs";
import { FileCache } from "./generator/fileCache";

export interface TsDocsCLIArgs extends OptionSource {
     "--": Array<string>,
     _: Array<string>,
     help?: boolean,
     init?: boolean
}

const args = parseArgs(process.argv.slice(2)) as TsDocsCLIArgs;

(async () => {
    if (args.help) return showHelp();
    if (args.init) return initConfig();

    addOptionSource({...args, entryPoints: args._});

    const tsconfig = findTSConfig<OptionSource>(process.cwd());

    if (tsconfig && tsconfig.tsdocsOptions) addOptionSource(tsconfig.tsdocsOptions);

    const tsDocsJs = findTsDocsJs(process.cwd());
    if (tsDocsJs) addOptionSource(tsDocsJs);

    if (!options.entryPoints.length) throw new Error("Expected at least one entry point.");

    const fileCache = new FileCache(options);

    const types = new TypescriptExtractor({
        entryPoints: options.entryPoints,
        externals: [handleDefaultAPI(), ...(options.externals||[]), ...handleNodeAPI()],
        maxConstantTextLength: 1024,
        ignoreFolderNames: ["lib"],
        passthroughModules: options.passthroughModules,
        tsconfig: options.tsconfig,
        fileCache: options.forceEmit ? undefined : fileCache,
    });

    const projects = types.run();
    const finalOptions = initOptions(projects);

    if (finalOptions.json) return fs.writeFileSync(finalOptions.json, JSON.stringify(projects));

    const generator = new Generator(finalOptions);

    await generator.generate(types, projects);

    fileCache.save();

    if (options.branches) renderBranches(projects, finalOptions, generator.structure);
})();
