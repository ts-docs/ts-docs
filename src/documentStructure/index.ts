
import { Generator } from "..";
import path from "path";
import fs from "fs";

export type Components = "class" | "constant" | "enum" | "function" | "functionParameter" | "interface" | "interfaceProperty" | "methodMember" | "module" | "propertyMember" | "type" | "typeArray" | "typeFunction" | "typeIntersection" | "typeObject" | "typeParameter" | "typeReference" | "typeTuple" | "typeUnion" | "typePrimitive" | "typeMapped" | "typeConditional" | "typeTemplateLiteral" | "typeIndexAccess" | "typeOperator" | "classConstructor" | "typePredicate" | "objectProperty" | "changelog" | "typeConstruct" | "jsdocTags" | "index";

export interface StaticDocumentationData {
    headerName: string,
    headerRepository?: string,
    headerHomepage?: string,
    headerVersion?: string,
    logo?: string,
    activeBranch: string,
    hasChangelog: boolean
}
/**
 * ## What is a documentation structure?
 * 
 * A documentation structure is something like a theme, but way more flexibale.
 * It doesn't only allow you to change the style of the page, but also it's functionality. 
 * A documentation structure provides functions which transform data about your project into HTML strings.
 * 
 * If you would like to change the generated site only stylistically, it's highly recommended to just use a
 * custom documentation structure. If you'd like to change how things are generated, for example maybe you'd
 * like to use [React Static](https://github.com/react-static/react-static), then write
 * your completely own generator using the [typescript extractor](https://github.com/ts-docs/ts-extractor)
 * 
 * To see how a documentation structure should look like, visit the repository of the [default documentation structure](https://github.com/ts-docs/default-docs-structure).
 * 
 * ### index
 * 
 * Every document structure should have an entry point which exports a function called `init`. The function must return an object containing all the functions for the [[Components as components]].
 * The default documentation structure uses plain template strings to generate the HMTL output (via [js-to-str](https://github.com/ts-docs/jsx-to-str)), but you could use a template engine, too.
 * 
 * The init function has two arguments, the [[StaticDocumentationData]] and the [[Generator as generator]].
 * 
 * #### component functions
 * 
 * A `component function` renders a specific component. A list of all component names can be found [[Components as here]]. Each function takes in exactly one argument - an object with data which is specific to the component at hand, and it **must** return a string.
 * 
 * ### assets folder
 * 
 * The assets folder contains files which will be used by the client. Images, css files and javascript files.
 */

export type DocumentStructure = {
    components: Record<Components, (data: unknown) => string>,
    assetsPath: string,
    data: StaticDocumentationData
}

export function setupDocumentStructure(structName: string, staticData: StaticDocumentationData, gen: Generator) : DocumentStructure {
    let initFn;
    try {
        initFn = require(structName);
    } catch {
        throw new Error(`Couldn't find documentation structure "${structName}"`);
    }
    let components = initFn.init(gen, staticData);
    const baseDir = path.join("./node_modules", structName);
    const packageJson = JSON.parse(fs.readFileSync(path.join(baseDir, "package.json"), "utf-8"))
    return {
        components, 
        assetsPath: path.join(baseDir, packageJson.assets),
        data: staticData
    }
}