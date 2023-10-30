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
    c?: T extends string ? 1 : 2;
    z?: Promise<string>;
    xxx?: keyof T;
    t?: MyInterface;
    //[key: string]: number;
    //test: Map<string, number> = new Map();
    //[A.B]: string = "abc";
    //private someProp: string;
    test(a: { a: string }) : string {
        return a.a;
    }
    secondParam(a: (val: number) => string) {
        return a(123);
    }
}

export interface MyInterface {
    a(a: number, b: string) : unknown;
    b: (a: number, b: string) => unknown;
}

export type ReturnType1<T> = T extends (...args: unknown[]) => infer R ? R : ReturnType1<T>;

if (myExtractor) {
    console.log(myExtractor.toJSON());
    fs.writeFileSync("./data.json", JSON.stringify(myExtractor));
}