import { ExtractorList } from "@ts-docs/extractor";

export interface LandingPage {
    repository?: string,
    readme?: string,
    homepage?: string
}

export interface TsDocsOptions {
    entryPoints: Array<string>,
    name: string,
    landingPage?: LandingPage,
    out: string,
    structure: string
}

export interface OptionSource {
    entryPoints?: Array<string>,
    name?: string,
    landingPage?: LandingPage|string,
    out?: string,
    structure?: string
}

export const options: TsDocsOptions = {
    out: "./docs",
    structure: "./node_modules/@ts-docs/default-docs-structure/dist/",
    entryPoints: [],
    name: ""
};

export function addOptionSource(source: OptionSource) : void {
    Object.assign(options, source);
    if (source.entryPoints && !Array.isArray(source.entryPoints)) throw new Error("Entry files must be an array of entry points.");
    if (source.out && typeof source.out !== "string") throw new Error("Output directory must be a valid string.");
    if (source.structure && typeof source.structure !== "string") throw new Error("Documentation structure must be a valid string.");
    if (source.name && typeof source.name !== "string") throw new Error("Project name must be a valid string.");
} 

export function initOptions(extractorList: ExtractorList) : TsDocsOptions {
    if (!options.name) options.name = extractorList[0].module.name;
    if (typeof options.landingPage === "string") options.landingPage = extractorList.find(ext => ext.module.name === options.landingPage); 
    else if (!options.landingPage) options.landingPage = extractorList[0];
    return options as TsDocsOptions;
}

export function showHelp() : void {
    console.log(
        `──── ts-docs help ────
Usage: ts-docs [...entryFiles]

-structure ─ The documentation structure to use. The default one is used by default.
-landingPage ─ Which module to act as the landing page. 
-name ─ The name of the page
-out ─ Where to emit the documentation files
`);
}