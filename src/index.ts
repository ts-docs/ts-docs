#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import parseArgs from "minimist";
import { findPackageJSON } from "@ts-docs/extractor/dist/util";
import { extract, extractMetadata } from "@ts-docs/extractor";
import { setupDocumentStructure } from "./documentStructure";
import { Generator } from "./generator";
import fs from "fs";
import { findTSConfig } from "./utils";

export interface LandingPage {
    repository?: string,
    readme?: string,
    homepage?: string
}

export interface TsDocsArgs {
     "--": Array<string>,
     _: Array<string>,
     help?: boolean,
     landingPage?: string,
     structure?: string,
     out?: string,
     name?: string
}

export interface TsDocsConfigOptions {
    landingPage?: string,
    structure?: string,
    name?: string,
    out?: string,
    entryPoints?: Array<string>
}

export interface TsDocsOptions {
    landingPage?: LandingPage,
    structure?: string,
    name?: string,
    out?: string,
    entryPoints: Array<string>
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const providedOptions: Record<string, any>  = {};
    const options: TsDocsOptions = { entryPoints: [] };

    const tsconfig = findTSConfig<TsDocsConfigOptions>(process.cwd());

    if (tsconfig && tsconfig.tsdocsOptions) Object.assign(providedOptions, tsconfig.tsdocsOptions);
    Object.assign(providedOptions, args);
    
    if (providedOptions.entryPoints.length) options.entryPoints.push(...providedOptions.entryPoints);
    if (args._.length) options.entryPoints.push(...args._);

    if (!providedOptions.structure) options.structure = "./node_modules/@ts-docs/default-docs-structure/dist/";
    else options.structure = providedOptions.structure;
    if (!providedOptions.out) options.out = "./docs";
    else options.out = providedOptions.out;
    
    options.name = providedOptions.name;
    if (!options.entryPoints.length) throw new Error("Expected at least one entry point.");

    const types = extract(options.entryPoints)[0];

    if (providedOptions.landingPage) {
        const pkg = types.find(t => t.module.name === providedOptions.landingPage);
        if (pkg) {
            options.landingPage = { repository: pkg.repository, homepage: pkg.homepage, readme: pkg.readme};
            if (!providedOptions.name) options.name = pkg?.module.name;
        }
    }

    const packageJSON = findPackageJSON(process.cwd());

    if (!options.name && packageJSON) {
        options.name = packageJSON.contents.name;
    }

    if (!providedOptions.landingPage && packageJSON) {
        const metadata = extractMetadata(packageJSON.path);
        options.landingPage = {
            readme: metadata.readme,
            repository: metadata.repository,
            homepage: metadata.homepage
        };
    }

    if (!options.landingPage) options.landingPage = types[0];
    if (!options.name) options.name = types[0].module.name;

    const docStructure = setupDocumentStructure(options.structure!);
    const generator = new Generator(docStructure, options);

    if (fs.existsSync(options.out!)) fs.rmSync(options.out!, { force: true, recursive: true });
    fs.mkdirSync(options.out!);

    generator.generate(types);
})();
