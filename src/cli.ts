#!/usr/bin/env node

import parseArgs from "minimist";
import { TypescriptExtractor } from "@ts-docs/extractor";
import { Generator } from "./generator";
import { emitError, emitNotification, findTSConfig, findTsDocsJs, handleDefaultAPI, handleNodeAPI } from "./utils";
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

    const tsconfig = findTSConfig(process.cwd());

    if (tsconfig && tsconfig.tsdocsOptions) addOptionSource(tsconfig.tsdocsOptions);

    const tsDocsJs = findTsDocsJs(process.cwd());
    if (tsDocsJs) addOptionSource(tsDocsJs);

    if (args._.length) addOptionSource({ ...args, entryPoints: args._ });
    else addOptionSource({ ...args });

    if (!options.entryPoints.length) return emitError`Expected at least one entry point.`;

    const fileCache = new FileCache(options);

    if (options.test) {
        options.docTests = true;
        options.forceEmit = true;
    }

    const types = new TypescriptExtractor({
        entryPoints: options.entryPoints,
        externals: [handleDefaultAPI(), ...(options.externals||[]), ...handleNodeAPI()],
        maxConstantTextLength: 1024,
        ignoreFolderNames: ["lib"],
        passthroughModules: options.passthroughModules,
        tsconfig: options.tsconfig,
        fileCache: options.forceEmit ? undefined : fileCache,
        stripInternal: options.stripInternal
    });

    const projects = types.run();
    const finalOptions = initOptions(projects);

    if (finalOptions.json) return fs.writeFileSync(finalOptions.json, JSON.stringify(projects));

    const generator = new Generator(finalOptions);

    await generator.generate(types, projects);

    if (generator.tests) {
        generator.tests.runClassSuites(generator);
        generator.tests.runFnSuites(generator);
    }

    fileCache.save();

    if (options.branches) renderBranches(projects, finalOptions);

    emitNotification`Successfully generated docs.`;
})();
