#!/usr/bin/env node

import parseArgs from "minimist";
import { TypescriptExtractor, Utils } from "@ts-docs/extractor";
import { setupDocumentStructure } from "./documentStructure";
import { Generator } from "./generator";
import { findTSConfig, findTsDocsJs } from "./utils";
import { addOptionSource, initOptions, options, OptionSource, showHelp } from "./options";

export interface TsDocsCLIArgs extends OptionSource {
     "--": Array<string>,
     _: Array<string>,
     help?: boolean
}

const args = parseArgs(process.argv.slice(2)) as TsDocsCLIArgs;

(() => {
    if (args.help) return showHelp();

    addOptionSource({...args, entryPoints: args._});

    const tsconfig = findTSConfig<OptionSource>(process.cwd());

    if (tsconfig && tsconfig.tsdocsOptions) addOptionSource(tsconfig.tsdocsOptions);

    const tsDocsJs = findTsDocsJs(process.cwd());
    if (tsDocsJs) addOptionSource(tsDocsJs);

    if (!options.entryPoints.length) throw new Error("Expected at least one entry point.");

    const types = new TypescriptExtractor({
        entryPoints: options.entryPoints,
        externals: options.externalLibs,
        maxConstantTextLength: 1024,
        ignoreFolderNames: ["lib"]
    });

    const projects = types.run();

    const packageJSON = Utils.findPackageJSON(process.cwd());

    const finalOptions = initOptions(projects);

    if (packageJSON) {
        if (!finalOptions.landingPage) {
            const metadata = Utils.extractMetadata(packageJSON.path);
            finalOptions.landingPage = {
                readme: metadata.readme,
                repository: metadata.repository,
                homepage: metadata.homepage
            };
        }
        if (!finalOptions.name) finalOptions.name = packageJSON.contents.name;
    } 

    const docStructure = setupDocumentStructure(finalOptions.structure);
    const generator = new Generator(docStructure, finalOptions);

    generator.generate(types, projects);
})();
