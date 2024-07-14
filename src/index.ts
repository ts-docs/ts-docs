/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unused-vars */
//import * as ts from "typescript";
import fs from "fs";
import {TypescriptExtractorHooks} from "./typescriptExtractor/extractor";
import {HookManager} from "./bases/hookManager";
import perf from "perf_hooks";
import {createExtractorGroup} from "./typescriptExtractor";
import { createBaseLogger, tsFormatter } from "./bases/logger";

const myHooks = new HookManager<TypescriptExtractorHooks>();

myHooks.attach("resolveExternalLink", (extractor, typeName, typeKind, typeLib, typeExtra) => {
    console.log(typeName.name, typeKind, typeLib, typeExtra);
    return undefined;
});

const before = perf.performance.now();
const logger = createBaseLogger("Base");

const result = createExtractorGroup({
    //cwd: "./test",
    passthroughModules: ["src"],
    //entries: [{path: "./utils"}, {path: "./rest"}, {path: "./client-socket"}, {path: "./client-rest"}, {path: "./client"}],
    logger: logger.withFormatter(tsFormatter),
    hooks: myHooks,
    entries: [{path: "./"}]
});
console.log(`Extraction took ${perf.performance.now() - before}ms`);
console.log(result.notFound);

fs.writeFileSync("./data.json", JSON.stringify(result.extractors.map(ext => ext.module)));
