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
    baby?: TypescriptExtractor | 123;
    a: string = "abc";
    b?: number = 123;
    //[key: string]: number;
    //test: Map<string, number> = new Map();
    //[A.B]: string = "abc";
    //private someProp: string;
    test(a: { a: string }) : string {
        return a.a;
    }
}

if (myExtractor) {
    console.log(myExtractor.modules.values());
    fs.writeFileSync("./data.json", JSON.stringify(myExtractor));
}