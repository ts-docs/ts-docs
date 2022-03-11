---
order: 1
---

# Options

You can provide options in three ways:

- The CLI
- `tsdocsOptions` property in your typescript configuration file.
- `tsdocs.config.js` file, which must export an object with the options. You can generate this file with the `--init` flag.

ts-docs combines all options in the following order:

- First, ts-docs attempts to find the options inside the `tsconfig.json` file.
- Then, ts-docs combines (overwrites if option is already specified, otherwise it adds it) the previous options with the options found inside the `tsdocs.config.js` file.
- Finally, CLI options get combined last.

``` --CLI
ts-docs ./entry/point.js --out ./docs
```
```json --tsconfig.json
"tsdocsOptions": {
    "entryPoints": ["./entry/point.js"],
    "out": "./docs"
}
```
```js --tsdocs.config.js
module.exports = {
    entryPoints: ["./entry/point.js"],
    out: "./docs"
}
```

## List of options

To check out all the default options in one place, see the [[ts-docs/options]] constant.

### entryPoints

The entry points of all projects you want to be included in the documentation. Every project should have exactly one entry point, and the **order** matters. If package A relies on package B, but package A is specified first, then you'll see some of package B's modules being inside of package A. This will be fixed in the future, but for now, **the order matters**.

### structure

Which documentation structure to use. You should only provide the **name** of the documentation structure, ts-docs expects it to be located inside your `node_modules` folder. ts-docs doesn't come with any documentation structures, but the default of this option is `default-docs-structure`. To install the default structure use the following command:

```
npm i --save-dev @ts-docs/default-docs-structure
```

### landingPage

If your project is a monorepo, you can use this option to tell ts-docs which repository to use the README, version and name of for the landing page. The first provided entry point is used by default. Keep in mind, if your landing page doesn't have a README file, a landing page won't be created for the documentation.

### name

The name of the project that appears in the sidebar. Name of first provided entry point is by default.

### out

Where to generate the files. This option is set to `./docs` by default.

### json

ts-docs will create a json file at the given path with all the project data which it uses to create the documentation, instead of actually creating the documentation.

### customPages

A path to a directory of custom pages. Inside that folder, each inner-folder is a category and each file inside that folder is a custom page.

### assets

A path to a folder with additional assets for the docs. It will copy all files and folders inside that folder and paste them inside the generated `./assets` folder.

### logo

A logo to use. It MUST be inside the folder provided to the `assets` option. The logo will be placed in the sidebar, below the name. 

### externals

An array of extenal libs. This option can only be supplied with the `tsdocs.config.js` file. To read more about external libraries and how to set them up, go [here](https://ts-docs.github.io/ts-docs/pages/Guides/Externals.html) 

### passthroughModules

If for some reason you don't want a specific folder to become a module, include the name of the folder it in the `passthroughModules` array. All the things inside that folder will be in the **parent** module. 

### branches

You can also document future (or previous) stable versions of your project using the `branches` option. When the option is provided, a "Branches" section is added to the left of the index page, where you can switch between other branches of your project.

ts-docs will use the same options to generate the different branches, except for `landingPage` - you have to specify the landing page yourself.

Here's how the option looks:

```js
{
    entryPoints: ["./project-a/src/index"],
    branches: [
        {
            displayName: "next", // The name of the branch that will be displayed, can be anything you want
            landingPage: "project-a", // The landing page of that branch
            branches: [ // The ACTUAL branches that will be included
                {
                    name: "dev", // The name of the branch
                    entryPoint: "./src/index", // The entry point of the project, relative to the root directory of the project
                    project: "project-a" // The name of the project (the name in package.json)
                },
                {
                    name: "main",
                    entryPoint: "./src/index",
                    external: "https://github.com/ts-docs/ts-extractor" // Link to the repository
                }
            ]
        }
    ],
}
```

The `branches` property should be an array of [[BranchOption]]. Use the [[BranchOption.project]] property if the branch is part of a project that is inside your [[TsDocsOptions.entryPoints]] option, otherwise, use the [[BranchOption.external]] option with a link to the repository.


### changelog

If this option is enabled, a changelog will be generated. ts-docs will attempt to get the latest release in the **repository of the landing page**.

### forceEmit

To make the generation process faster, ts-docs will save the last time your files were modified, and the next time you want to generate documentation, ts-docs will skip untouched files. Turning on this option will always make it so new documentation is generated.

### tsconfig

Path to a `tsconfig.json` file to use for the typescript compiler. The ts-docs extractor works best with a specific set of options, so if for some reason the docs you're getting are messed up, either provide a path to your project's `tsconfig.json` file, or pass `"none"`, which will pick the best compiler options to use.

### exportMode

How should exports be displayed.

- `simple` - Only the names of all the exported elements from the `index.ts` file are shown. If the module doesn't have an `index.ts` file, then no exports are shown. 
- `detailed` - The exports from every file in the module are shown separately. 

The default option is set to `simple`.

### stripInternal

Removes all internal items from the generated documentation, **but** it keeps references around. This option is inherited from the `stripInternal` option in your `tsconfig.json` file. (You may have to point ts-docs to your `tsconfig.json` file via the `tsconfig` option.)

### sort

How to sort items (classes, interfaces, enums, functions, constants, types, methods, properties, enum members)

- `source` - How they were found in the source code, this is the default option
- `alphabetical`

### docTests

Transpiles and runs typescript and javascript code inside function / method documentation comments. This option only works when there is a single output directory. Check out the [Documentation Tests](./DocumentationDocumentation%20Tests) guide for more information.

### test

Runs only specific tests. For example:

```ts
class A {

    /**
     * ```ts
     * assert(true);
     * ```
     */
    a() {
        //...
    }
}

/**
 * ```ts
 * // ...
 * ```
 */
function a() {
    //...
}
```

Running ts-docs with:

- `--test a` will only transpile and run the tests under any functions named `a`. This does **not** include the `a` method in the example above.
- `--test A` will only tanspile and run tests which belong to methods inside the `A` class (or any functions caled `A`).
- `--test A.a` will only transpile and run tests which belong to the `a` method inside the `A` class.

Using this option automatically enables the `docTests` and the `forceEmit` options.

### logNotDocumented

Logs all items which have no proper documentation to the console. These include:

- Classes
    - Methods with non-computed names
    - Properties with non-computed names
- Interfaces
    - Properties with non-computed names / no functions / no constructors
- Enums
    - Enum members without initializers
- Functions
- Type aliases
- Constants

You can filter out items by passing an array of strings instead. If you have the following configuration, ts-docs will only log classes and interfaces, along with all their methods and properties:

```json
"logNotDocumented": ["class", "interface"]
```

