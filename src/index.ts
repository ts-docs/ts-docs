//import * as ts from "typescript";
import path from "path";
import { TypescriptExtractor } from "./projectExtractor/extractor";

const myExtractor = TypescriptExtractor.createStandaloneExtractor(process.cwd().replaceAll(path.sep, "/"), { passthroughModules: ["src", "inner"]});

console.dir(myExtractor?.modules, { depth: 1000, colors: true });