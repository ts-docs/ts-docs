
import { Generator } from "..";
import path from "path";
import fs from "fs";
import { emitError } from "../utils";

export type Components = "class" | "constant" | "enum" | "function" | "functionParameter" | "interface" | "module" | "type" | "typeArray" | "typeFunction" | "typeIntersection" | "typeObject" | "typeParameter" | "typeReference" | "typeTuple" | "typeUnion" | "typePrimitive" | "typeMapped" | "typeConditional" | "typeTemplateLiteral" | "typeIndexAccess" | "typeOperator" | "typePredicate" | "changelog" | "typeConstruct" | "jsdocTags" | "codeTabs" | "index";

/**
 * ## What is a documentation structure?
 * 
 * A documentation structure is something like a theme, but way more flexibale.
 * It doesn't only allow you to change the style of the page, but also it's functionality. 
 * A documentation structure provides functions which transform data about your project into HTML strings.
 * 
 * If you would like to change the generated site only stylistically, it's highly recommended to just use a
 * custom documentation structure. If you'd like to change how things are generated, for example maybe you'd
 * like to use [React Static](https://github.com/react-static/react-static) to make your documentation an SPA, then write
 * your completely own generator using the [typescript extractor](https://github.com/ts-docs/ts-extractor)
 * 
 * To see how a documentation structure should look like, visit the repository of the [default documentation structure](https://github.com/ts-docs/default-docs-structure).
 * 
 * ### index
 * 
 * Every document structure should have an entry point which exports a function called `init`. The function must return an object containing all the functions for the [[Components as components]].
 * The default documentation structure uses plain template strings to generate the HMTL output, but you could use a templating engine, too.
 * 
 * The init function has two arguments, the [[StaticDocumentationData]] and the [[Generator as generator]].
 * 
 * #### component functions
 * 
 * A `component function` renders a specific component. A list of all component names can be found [[Components as here]]. Each function takes in exactly one argument - an object with data which is specific to the component at hand, and it **must** return a string.
 * 
 * ### assets folder
 * 
 * The assets folder contains files which will be used by the client. Images, css files and javascript files. You need to specify where the assets folder is located via the `assets` property in
 * the package.json for the documentation generator.
 * 
 * ### jsx-to-str
 * 
 * The default documentation generator uses [jsx-to-str](https://github.com/ts-docs/jsx-to-str), a typescript transformer which turns JSX literals into plain strings **during transpilation**.
 */

export type DocumentStructure = {
    components: Record<Components, (data: unknown) => string>,
    assetsPath: string
}

export function setupDocumentStructure(structName: string, gen: Generator) : DocumentStructure {
    let initFn;
    try {
        initFn = require(path.join(process.cwd(), `./node_modules/${structName}`));
    } catch {
        throw emitError`Couldn't find documentation structure "${structName}"`;
    }
    const components = initFn.init(gen);
    const baseDir = path.join("./node_modules", structName);
    const packageJson = JSON.parse(fs.readFileSync(path.join(baseDir, "package.json"), "utf-8"));
    return {
        components, 
        assetsPath: path.join(baseDir, packageJson.assets)
    };
}