
import fs from "fs";
import Handlebars from "handlebars";
import path from "path";

/**
 * This repository is responsible for the **generation** of the documentation. It takes a directory of
 * .hbs files (called a "documentation structure"), and a list of paths to the projects to generate the documentation for. 
 * 
 * A documentation structure should look like this:
 * - assets
 *  - css
 *  - src
 *  - media
 * - components
 *  - propertyMember.hbs
 *  - methodMember.hbs
 *  - function.hbs
 *  - enum.hbs
 *  - interface.hbs
 *  - class.hbs
 *  - module.hbs
 * - partials
 *  - footer.hbs
 *  - header.hbs
 *  - navigation.hbs
 * - index.hbs
 * - helpers.js
 * 
 * This app outputs something like:
 * - index.html
 * - assets
 * - module_name
 *  - classes
 *  - interfaces
 *  - enums
 *  - functions
 *  - types
 *  - m.module_name_2
 *      - classes
 *      - interfaces
 *      - enums
 *      - functions
 *      - types
 * 
 * URL links look like this:
 * https://base.com/module_name/classes/class_name
 * https://base.com/module_name/m.module_name_2/types/type_name
 */

export interface DocumentStructure {
    path: string,
    components: Record<string, string>,
    index: string
}


export function setupDocumentStructure(pathToStructure: string) : DocumentStructure {
    if (!fs.existsSync(pathToStructure)) throw new Error("Couldn't find documentation structure.");
    const partials = path.join(pathToStructure, "partials");
    if (!fs.existsSync(partials)) throw new Error("Couldn't find partials folder.");
    for (const partialFile of fs.readdirSync(partials).filter(f => f.endsWith(".hbs"))) {
        const fileContents = fs.readFileSync(path.join(partials, partialFile), "utf-8");
        Handlebars.registerPartial(partialFile.slice(0, -4), fileContents);
    }
    const componentsPath = path.join(pathToStructure, "components");
    if (!fs.existsSync(componentsPath)) throw new Error("Couldn't find components folder.");
    const components: Record<string, string> = {};
    for (const componentFile of fs.readdirSync(componentsPath).filter(f => f.endsWith(".hbs"))) {
        components[componentFile.slice(0, -4)] = fs.readFileSync(path.join(componentsPath, componentFile), "utf8");
    }
    const index = path.join(pathToStructure, "index.hbs");
    if (!fs.existsSync(index)) throw new Error("Couldn't find index.hbs file.");
    const helpers = path.join(pathToStructure, "helpers.hbs");
    if (fs.existsSync(helpers)) require(helpers);
    return {
        path: pathToStructure,
        components,
        index: fs.readFileSync(index, "utf8")
    };
}