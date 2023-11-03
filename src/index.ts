/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unused-vars */
//import * as ts from "typescript";
import fs from "fs";
import { TypescriptExtractorHooks } from "./typescriptExtractor/extractor";
import { HookManager } from "./typescriptExtractor/hookManager";
import perf from "perf_hooks";
import { createExtractorGroup } from "./typescriptExtractor";

const myHooks = new HookManager<TypescriptExtractorHooks>();

myHooks.attach("resolveExternalLink", (extractor, typeName, typeKind, typeLib, typeExtra) => {
    //console.log(typeName.name, typeKind, typeLib, typeExtra);
    return undefined;
});

const before = perf.performance.now();
const result = createExtractorGroup({
    cwd: "./test",
    passthroughModules: ["src"],
    //entries: [{path: "./utils"}, {path: "./rest"}, {path: "./client-socket"}, {path: "./client-rest"}, {path: "./client"}],
    entries: [{path: "./"}]
    //hooks: myHooks
});
console.log(`Extraction took ${perf.performance.now() - before}ms`);

fs.writeFileSync("./data.json", JSON.stringify(result.extractors.map(ext => ext.module)));