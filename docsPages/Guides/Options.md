---
order: 1
---

# Options

You can provide options for ts-docs in three ways:

- The CLI
- `tsdocsOptions` property in your typescript configuration file.
- `tsDocs.config.js` file, which must export an object with the options.

ts-docs first gets all CLI arguments, then joins them with the options from the typescript configuration, and finally with the `tsDocs.config.js` file. 

## CLI usage

```ts-docs --options <entry points>```

## Tsconfig usage

```json
  "tsdocsOptions": {
    "entryPoints": ["/entry/point.js"],
    ...other options
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

If your project is a monorepo, you can use this option to tell ts-docs which repository to use the README, version and name of for the landing page. The first provided entry point is used by default. 

### name

The name of the project that appears in the sidebar. Name of first provided entry point is by default.

### out

Where to generate the files. This option is set to `./docs` by default.

### customPages

A path to a directory of custom pages. Inside that folder, each inner-folder is a category and each file inside that folder is a custom page.

### assets

A path to a folder with assets with additional assets for the docs. It will copy all files and folders inside that folder and paste them inside the generated `./assets` folder.

### logo

A logo to use. It MUST be inside the folder provided to the `assets` option. The logo will be placed in the sidebar, below the name. 

### externals

An array of extenal libs. This option can only be supplied with the `tsDocs.config.js` file. To read more about external libraries and how to set them up, go [here](https://ts-docs.github.io/ts-docs/pages/Guides/Externals.html) 

### passthroughModules

If for some reason you don't want a specific folder to become a module, include the name of the folder it in the `passthroughModules` array. All the things inside that folder will be in the **parent** module. 

### branches

You can also document future (or previous) stable versions of your module using the `branches` option. When the option is provided, a "Branches" section is added to the left of the index page, where you can switch between other branches of your project.

The generator is going to use your already provided options for generating the different branches, except for the `landingPage` option. The branches in the `branches` array need to be a part of a `project`, so you cannot include branches from completely different repositories, which are from projects that are not in your `entryPoints` option.

Here's how the option looks:

```js
branches: [
        {
            displayName: "next", // The name of the branch that will be displayed, can be anything you want
            landingPage: "detritus-client", // The landing page of that branch
            branches: [ // The ACTUAL branches that will be included
                {
                    name: "master", // The name of the branch
                    entryPoint: "./src/index", // The entry point of the project, relative to the root directory of the project
                    project: "detritus-utils" // The name of the project (the name in package.json)
                },
                {
                    name: "0.16.4",
                    entryPoint: "./src/index",
                    project: "detritus-client"
                }
            ]
        }
    ],
```

### changelog

If this option is enabled, a changelog will be generated. ts-docs will attempt to get the latest release in the **repository of the landing page**.