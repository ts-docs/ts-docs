//import * as ts from "typescript";
import path from "path";
import fs from "fs";
import { TypescriptExtractor } from "./projectExtractor/extractor";

const myExtractor = TypescriptExtractor.createStandaloneExtractor(process.cwd().replaceAll(path.sep, "/"), { passthroughModules: ["src", "inner"]});

export class Test {
    [key: string]: number;
}

if (myExtractor) {
    console.log(myExtractor.modules.values());
    fs.writeFileSync("./data.json", JSON.stringify(myExtractor));
}