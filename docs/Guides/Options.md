---
order: 0
---

# Options

You can provide options for ts-docs in two ways:

- The CLI
- `tsdocsOptions` property in your typescript configuration file.

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

### structure

Which documentation structure to use. You should only provide the **name** of the documentation structure, ts-docs expects it to be located inside your `node_modules` folder. ts-docs doesn't come with any documentation structures, but the default of this option is `default-docs-structure`. To install the default structure use the following command:

```
npm i @ts-docs/default-docs-structure
```

### landingPage

If your project is a monorepo, you can use this option to tell ts-docs which repository to use the README, version and name of for the landing page. The first provided entry point is used by default.

### name

The name of the project. Name of irst provided entry point is by default.

### out

Where to generate the files. This option is set to `./docs` by default.

### customPages

A path to a directory of custom pages. Inside that folder, each inner-folder is a category and each file inside that folder is a custom page.

### assets

A path to a folder with assets with additional assets for the docs. It will copy all files and folders inside that folder.

### logo

A logo to use. It MUST be inside the folder provided to the `assets` option.



