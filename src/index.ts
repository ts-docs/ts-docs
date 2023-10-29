//import * as ts from "typescript";
import path from "path";
import fs from "fs";
import { TypescriptExtractor } from "./projectExtractor/extractor";

const myExtractor = TypescriptExtractor.createStandaloneExtractor(process.cwd().replaceAll(path.sep, "/"), { passthroughModules: ["src", "inner"]});

export enum A {
    A,
    B
}

export class Test<T> {
    //[key: string]: number;
    [A.B]: string = "abc";
    //private someProp: string;
}

if (myExtractor) {
    console.log(myExtractor.modules.values());
    fs.writeFileSync("./data.json", JSON.stringify(myExtractor));
}