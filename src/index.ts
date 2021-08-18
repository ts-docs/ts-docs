#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import parseArgs from "minimist";
import { findPackageJSON } from "@ts-docs/extractor/dist/util";
import { extract, extractMetadata } from "@ts-docs/extractor";
import { setupDocumentStructure } from "./documentStructure";
import { Generator } from "./generator";
import { findTSConfig } from "./utils";
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

    if (!options.entryPoints.length) throw new Error("Expected at least one entry point.");

    const types = extract(options.entryPoints)[0];

    const packageJSON = findPackageJSON(process.cwd());

    const finalOptions = initOptions(types);

    if (packageJSON) {
        if (!finalOptions.landingPage) {
            const metadata = extractMetadata(packageJSON.path);
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

    generator.generate(types);
})();
