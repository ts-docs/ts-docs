/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unused-vars */
//import * as ts from "typescript";
import fs from "fs";
import path from "path";
import {TypescriptExtractorHooks} from "./typescriptExtractor/extractor";
import {HookManager} from "./bases/hookManager";
import perf from "perf_hooks";
import {createExtractorGroup} from "./typescriptExtractor";
import {createBaseLogger, createTsFormatter} from "./bases/logger";

const myHooks = new HookManager<TypescriptExtractorHooks>();

// myHooks.attach("resolveExternalLink", (extractor, typeName, typeKind, typeLib, typeExtra) => {
//     console.log(typeName.name, typeKind, typeLib, typeExtra);
//     return undefined;
// });

// A hook which adds README files to modules
myHooks.attach("createModule", (extractor, module, isTop) => {
    const baseDir = !isTop ? path.join(extractor.module.baseDir, module.baseDir) : module.baseDir;
    let readme;
    const uppercase = path.join(baseDir, "README.md");
    if (fs.existsSync(uppercase)) readme = fs.readFileSync(uppercase, {encoding: "utf-8"});
    else {
        const lowercase = path.join(baseDir, "readme.md");
        if (fs.existsSync(lowercase)) readme = fs.readFileSync(lowercase, {encoding: "utf-8"});
    }
    module.readme = readme;
});

const before = perf.performance.now();
const logger = createBaseLogger("Base");

const result = createExtractorGroup({
    //cwd: "./test",
    passthroughModules: ["src"],
    entries: [{path: "./test/utils"}, {path: "./test/rest"}, {path: "./test/client-socket"}, {path: "./test/client-rest"}, {path: "./test/client"}],
    logger: logger.withFormatter(createTsFormatter(true)),
    hooks: myHooks
    //entries: [{path: "./test"}]
});
console.log(`Extraction took ${perf.performance.now() - before}ms`);
console.log(result.notFound);

fs.writeFileSync("./data.json", JSON.stringify(result.extractors.map(ext => ext.module)));
