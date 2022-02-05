/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Project, ExternalReference, Utils } from "@ts-docs/extractor";
import FrontMatter from "front-matter";
import fs from "fs";
import path from "path";
import { BranchSetting } from "./branches";

export interface LandingPage {
    repository?: string,
    readme?: string,
    homepage?: string,
    version?: string
}

export interface CustomPageAttributes {
    order?: number,
    name?: string
}

export interface CustomPage {
    name: string,
    content: string,
    attributes: CustomPageAttributes
}

export interface PageCategory {
    name: string,
    pages: Array<CustomPage>
}


export interface TsDocsOptions {
    entryPoints: Array<string>,
    customPages?: Array<PageCategory>
    name: string,
    landingPage?: LandingPage,
    out: string,
    structure: string,
    assets?: string,
    logo?: string,
    externals?: Array<ExternalReference>,
    passthroughModules?: Array<string>,
    branches?: Array<BranchSetting>,
    changelog?: boolean,
    json?: string,
    tsconfig?: string,
    forceEmit?: boolean,
    exportMode: "simple" | "detailed",
    stripInternal?: boolean,
    sort?: "source" | "alphabetical"
}

export interface OptionSource {
    entryPoints?: Array<string>,
    customPages?: string,
    name?: string,
    landingPage?: LandingPage|string,
    out?: string,
    structure?: string,
    assets?: string,
    logo?: string,
    externals?: Array<ExternalReference>,
    passthroughModules?: Array<string>,
    branches?: Array<BranchSetting>,
    changelog?: boolean,
    json?: string,
    tsconfig?: string,
    forceEmit?: boolean,
    exportMode?: string,
    stripInternal?: boolean,
    sort?: "source" | "alphabetical"
}

export const options: TsDocsOptions = {
    out: "./docs",
    structure: "@ts-docs/default-docs-structure",
    entryPoints: [],
    name: "",
    exportMode: "simple"
};

export function addOptionSource(source: OptionSource) : void {
    Object.assign(options, source);
    if (source.entryPoints && !Array.isArray(source.entryPoints)) throw new Error("Entry files must be an array of entry points.");
    if (source.out && typeof source.out !== "string") throw new Error("Output directory must be a valid string.");
    if (source.structure && typeof source.structure !== "string") throw new Error("Documentation structure must be a valid string.");
    if (source.name && typeof source.name !== "string") throw new Error("Project name must be a valid string.");
    if (source.customPages && typeof source.customPages !== "string") throw new Error("Custom pages must be path to a directory.");
    if (source.assets && typeof source.assets !== "string") throw new Error("Path to assets must be a string.");
    if (source.logo && typeof source.logo !== "string") throw new Error("Path to logo must be a string.");
    if (source.externals && !Array.isArray(source.externals)) throw new Error("External Libraries must be an array.");
    if (source.passthroughModules && !Array.isArray(source.passthroughModules)) throw new Error("Passthrough Modules must be an array.");
    if (source.branches && !Array.isArray(source.branches)) throw new Error("Branches must be an array.");
    if (source.json && typeof source.json !== "string") throw new Error("JSON output path must be a string.");
} 

export function initOptions(extractorList: Array<Project>) : TsDocsOptions {
    if (typeof options.landingPage === "string") {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const module = extractorList.find(ext => ext.module.name === options.landingPage);
        if (!module) throw new Error(`"${options.landingPage}" is not in the entry points.`)
        options.landingPage = module;
        if (!options.name) options.name = module.module.name;
    }
    if (!options.name) options.name = extractorList[0].module.name;
    if (!options.landingPage) options.landingPage = extractorList[0];
    if (options.customPages) {
        const customPages = options.customPages as unknown as string;
        const res = [];
        for (const category of fs.readdirSync(customPages, {withFileTypes: true})) {
            if (category.isFile()) continue;
            const pages = [];
            const categoryPath = path.join(process.cwd(), customPages, category.name);
            for (const file of fs.readdirSync(categoryPath)) {
                if (!file.endsWith(".md")) continue;
                const content = FrontMatter<CustomPageAttributes>(fs.readFileSync(path.join(categoryPath, file), "utf-8"));
                pages.push({
                    name: content.attributes.name || file.slice(0, -3),
                    content: content.body,
                    attributes: content.attributes
                });
            }
            res.push({name: category.name, pages});
        }
        options.customPages = res;
    }
    if (!options.landingPage!.repository) options.changelog = false;
    if (!options.landingPage!.readme) {
        options.landingPage.readme = Utils.getReadme("./");
    }
    return options as TsDocsOptions;
}

export function showHelp() : void {
    console.log(
        `──── ts-docs help ────
Usage: ts-docs [...entryFiles]


--structure         The documentation structure to use. 
--landingPage       Which module to act as the landing page. 
--name              The name of the page.
--out               Where to emit the documentation files.
--customPages       A folder which contains folders which contain .md files.
--assets            All files and folders inside the folder will be copied to the /assets output directory. In markdown, files in this directory can be linked with "./assets/filename.ext"
--logo              Path to the project's logo.
--changelog         If to add a changelog to the generated output.
--json              Instead of generating documentation, ts-docs will spit all the json data in the path you provide.
--init              Creates a tsdocs.config.js file.
--forceEmit         Skips checking file cache for changes, always produces new documentation.
--tsconfig          Path to tsconfig.json file.
--exportMode        "simple" or "detailed". Simple mode just lists all the exports from the index file, detailed mode lists all exports of all files in the module.
--stripInternal     Removes all items flagged with the internal tag.
--sort              Either "source" or "alphabetical".
--help
`);
}

export function initConfig() : void {
    if (fs.existsSync("./tsdocs.config.js")) return console.log("A ts-docs configuration file already exists here.");
    fs.writeFileSync("./tsdocs.config.js", `
module.exports = {
    // See more options at https://tsdocs.xyz/pages/Guides/Options

    entryPoints: [], // Entry points, every project you want to include in the documentation should have exactly one entry point
    name: "", // The name of your project
    out: "./docs", // Where to put the generated documentation
    exportMode: "simple"
}
    `);
    console.log("Successfully created a ts-docs configuration file.");
}