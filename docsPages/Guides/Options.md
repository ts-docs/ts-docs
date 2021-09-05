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

### structure

Which documentation structure to use. You should only provide the **name** of the documentation structure, ts-docs expects it to be located inside your `node_modules` folder. ts-docs doesn't come with any documentation structures, but the default of this option is `default-docs-structure`. To install the default structure use the following command:

```
npm i --save-dev @ts-docs/default-docs-structure
```

### landingPage

If your project is a monorepo, you can use this option to tell ts-docs which repository to use the README, version and name of for the landing page. The first provided entry point is used by default.

### name

The name of the project that appears in the sidebar. Name of irst provided entry point is by default.

### out

Where to generate the files. This option is set to `./docs` by default.

### customPages

A path to a directory of custom pages. Inside that folder, each inner-folder is a category and each file inside that folder is a custom page.

### assets

A path to a folder with assets with additional assets for the docs. It will copy all files and folders inside that folder and paste them inside the generated `./assets` folder.

### logo

A logo to use. It MUST be inside the folder provided to the `assets` option. The logo will be placed in the sidebar, below the name. 

### externalLibs

An array of extenal libs. This option can only be supplied with the `tsDocs.config.js` file. To read more about external libraries and how to set them up, go [here](https://ts-docs.github.io/ts-docs/pages/Guides/External%20Libs.html) 

