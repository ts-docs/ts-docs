#!/usr/bin/env node

import parseArgs from "minimist";
import { findTSConfigDown, findPackageJSON } from "@ts-docs/extractor/dist/util";
import { extract, ProjectMetadata, TypescriptExtractor, extractMetadata } from "@ts-docs/extractor";
import { setupDocumentStructure } from "./documentStructure";
import { Generator } from "./generator";
import fs from "fs";

export interface TsDocsArgs {
     "--": Array<string>,
     _: Array<string>,
     help?: boolean,
     landingPage?: string,
     structure?: string,
     out?: string,
     name?: string
}

export interface TsDocsOptions {
    landingPage?: ProjectMetadata|TypescriptExtractor,
    structure?: string,
    name?: string,
    out?: string,
    entryPoints?: Array<string>
}

const args = parseArgs(process.argv.slice(2)) as TsDocsArgs;

(() => {
    if (args.help) {
        console.log(
            `──── ts-docs help ────
Usage: ts-docs [...entryFiles]

-struct ─ The documentation structure to use. The default one is used by default.
-landingPage ─ Which module to act as the landing page. 
-name ─ The name of the page
-out ─ Where to emit the documentation files
`);
        return;
    }

    const options: TsDocsOptions = {};

    const tsconfig = findTSConfigDown(process.cwd()) as Record<string, TsDocsOptions>;

    if (tsconfig && tsconfig.tsdocsOptions) Object.assign(options, tsconfig.tsdocsOptions);
    Object.assign(options, args);
    
    if (!options.entryPoints) options.entryPoints = args._;
    else options.entryPoints.push(...args._);

    if (!options.structure) options.structure = "./node_modules/@ts-docs/default-docs-structure/dist/";
    if (!options.out) options.out = "./docs";
    if (!options.entryPoints.length) throw new Error("Expected at least one entry point.");

    const types = extract(options.entryPoints)[0];

    if (options.landingPage) options.landingPage = types.find(t => t.module.name === options.landingPage);

    if (!options.name || !options.landingPage) {
        const packageJSON = findPackageJSON(process.cwd());
        if (packageJSON) {
            options.name = packageJSON.contents.name;
            options.landingPage = extractMetadata(packageJSON.path);
        }
    }

    if (types.length === 1  && !options.landingPage) options.landingPage = types[0];

    const docStructure = setupDocumentStructure(options.structure);
    const generator = new Generator(docStructure, options);

    if (fs.existsSync(options.out)) fs.rmSync(options.out, { force: true, recursive: true });
    fs.mkdirSync(options.out);

    const generatedTypes = extract(options.entryPoints);
    generator.generateModule(options.out, generatedTypes[0][0].module);
})();
