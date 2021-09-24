
import fs from "fs";
import Handlebars from "handlebars";
import path from "path";

export type Components = "class" | "constant" | "enum" | "function" | "functionParameter" | "interface" | "interfaceProperty" | "methodMember" | "module" | "propertyMember" | "type" | "typeArray" | "typeFunction" | "typeIntersection" | "typeObject" | "typeParameter" | "typeReference" | "typeTuple" | "typeUnion" | "typePrimitive" | "typeMapped" | "typeConditional" | "typeTemplateLiteral" | "typeIndexAccess" | "typeOperator" | "classConstructor" | "typePredicate" | "objectProperty";

/**
 * ## What is a documentation structure?
 * 
 * A documentation structure is something like a theme, but way more flexibale.
 * It doesn't only allow you to change the style of the page, but also it's functionality. 
 * A documentation structure provides all handlebar templates to the [[Generator]], and also all
 * client-side scripts, CSS and other required media. 
 * 
 * If you would like to change the generated site only stylistically, it's highly recommended to just use a
 * custom documentation structure. If you'd like to change how things are generated, for example maybe you'd
 * like to use [React Static](https://github.com/react-static/react-static) instead of handlebars, then write
 * your completely own generator using the [typescript extractor](https://github.com/ts-docs/ts-extractor)
 * 
 * To see how a documentation structure should look like, visit the repository of the [default documentation structure](https://github.com/ts-docs/default-docs-structure)
 * 
 * ### index.hbs
 * 
 * `index.hbs` contains the structure of EVERY file generated by the generator.
 * 
 * ### components folder
 * 
 * The generator pre-compiles all the components in the `components` folder and uses them. It does it like this
 * because we believe that there should be almost no logic inside your handlebars templates. Each template should
 * be short and easily read, without many if/each blocks. The rendered HTML from the component is then passed to
 * other components or the `index.hbs` file directly. For example, the generation process for a single class is this:
 * 
 * First, all children of the class are compiled: constructor (`classConstructor` component), methods (`methodMember` component) and properties (`propertyMember` component).
 * The HTML code is then given to the `class` component, and all it has to do is this:
 * 
 * ```hbs
 * {{#each properties}}
    <div>{{{this}}}</div>
    {{/each}}
 * ```

 * Which makes the entire process a lot simpler!
 * 
 * ### partials folder
 * 
 * In the partials folder you can create Handlebars partials, which can then be used in components or other partials.
 * 
 * ### helpers.js file
 * 
 * The helpers.js file is executed during the generation process, it allows you to create helpers which can be used in components.
 * The helpers.js file has access to the `Handlebars` object. 
 * 
 * ### assets folder
 * 
 * The assets folder contains files which will be used by the client. Images, css files and javascript files.
 */

export interface DocumentStructure {
    path: string,
    components: Record<Components, HandlebarsTemplateDelegate<unknown>>,
    index: HandlebarsTemplateDelegate<unknown>
}

export function setupDocumentStructure(structName: string) : DocumentStructure {
    const pathToPackageJSON = path.join(`./node_modules/${structName}/package.json`);
    if (!fs.existsSync(pathToPackageJSON)) throw new Error(`Couldn't find package.json file for "${structName}" document structure.`);
    const packageJSON = JSON.parse(fs.readFileSync(pathToPackageJSON, "utf-8"));
    if (!packageJSON.main) throw new Error(`Couldn't find "main" property in package.json for "${structName}" document structure.`);
    const pathToStructure = path.join("./node_modules", structName, packageJSON.main);
    if (!fs.existsSync(pathToStructure)) throw new Error("Couldn't find documentation structure.");
    const partials = path.join(pathToStructure, "partials");
    if (!fs.existsSync(partials)) throw new Error("Couldn't find partials folder.");
    for (const partialFile of fs.readdirSync(partials).filter(f => f.endsWith(".hbs"))) {
        const fileContents = fs.readFileSync(path.join(partials, partialFile), "utf-8");
        Handlebars.registerPartial(partialFile.slice(0, -4), fileContents);
    }
    const componentsPath = path.join(pathToStructure, "components");
    if (!fs.existsSync(componentsPath)) throw new Error("Couldn't find components folder.");
    const components: Record<string, HandlebarsTemplateDelegate<unknown>> = {};
    for (const componentFile of fs.readdirSync(componentsPath).filter(f => f.endsWith(".hbs"))) {
        components[componentFile.slice(0, -4)] = Handlebars.compile(fs.readFileSync(path.join(componentsPath, componentFile), "utf8"));
    }
    const index = path.join(pathToStructure, "index.hbs");
    if (!fs.existsSync(index)) throw new Error("Couldn't find index.hbs file.");
    const helpers = path.join(pathToStructure, "helpers.js");
    if (fs.existsSync(helpers)) (new Function("Handlebars", fs.readFileSync(helpers, "utf-8")))(Handlebars);
    return {
        path: pathToStructure,
        components,
        index: Handlebars.compile(fs.readFileSync(index, "utf8"))
    };
}