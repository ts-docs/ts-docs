---
name: Generating docs programmatically
order: 7
---

# Generating docs programmatically

You can use the [[Generator]] class to generate documentation automatically. That class doesn't extract any information from any projects, so you'll have to do that yourself using the [[TypescriptExtractor]] class.

## Extracting information

You can check out all the options the extractor accepts [[TypescriptExtractorSettings as here]].

```ts
import { TypescriptExtractor } from "@ts-docs/extractor";

const entryPoints = ["./src/index.ts"];

const extractor = new TypescriptExtractor({
    entryPoints,
    maxConstantTextLength: 1024,
    // Recommended
    ignoreFolderNames: ["lib"]
});
```

## Generating documentation

You can check out all the options the extractor accepts [[TsDocsOptions as here]]. 

```ts
import { Generator } from "@ts-docs/ts-docs";

const generator = new Generator({
    entryPoints,
    name: "My Project",
    out: "./docs",
    structure: "default-docs-structure"
});

generator.generate(extractor);
```

### Customizing output

Let's say you don't want to save the generated files to your computer, but instead send them to a hosting platform for example. You can pass a custom [[FileHost]] to the [[Generator]] constructor:

```ts
import { FileHost, Generator } from "@ts-docs/ts-docs";
import path from "path";

// We'll keep the files and their contents here.
const files = new Map();

const MyFileHost: FileHost = {
    exists: (path) => files.has(path),
    createFile: (basePath, folder, file, content) => {
        const folderPath = path.join(basePath, folder);
        files.set(path.join(folderPath, file), content);
        return folderPath;
    },
    copyFolder: (origin, destination) => {
        // ...
    },
    readFile: (path) => {
        if (!files.has(path)) throw new Erorr("...");
        return files.get(path);
    },
    createDir: (p, name) => path.join(p, name),
    writeFile: (path, content) => files.set(path, content),
    getDocumentStructure: () => false
}

const gen = new Generator({
    //...
}, MyFileHost);
```
