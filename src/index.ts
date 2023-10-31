/* eslint-disable @typescript-eslint/no-unused-vars */
//import * as ts from "typescript";
import path from "path";
import fs from "fs";
import { TypescriptExtractor, TypescriptExtractorHooks } from "./projectExtractor/extractor";
import { HookManager } from "./projectExtractor/hookManager";

const myHooks = new HookManager<TypescriptExtractorHooks>();

myHooks.attach("resolveExternalLink", (extractor, typeName, typeKind, typeLib, typeExtra) => {
    console.log(typeName.name, typeKind, typeLib, typeExtra);
    return undefined;
});

const myExtractor = TypescriptExtractor.createStandaloneExtractor(process.cwd().replaceAll(path.sep, "/"), { passthroughModules: ["src", "inner"] }, myHooks);

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
    myTuple?: [nameA: string, boolean, nameC?: number, number?];
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

export const enum MyEnum {
    b,
    c,
    e,
    a = "abc"
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

export type Getters<Type> = {
    [Property in keyof Type as `get${Capitalize<string & Property>}`]: () => Type[Property]
};

export const NUM_CONST = 123;

export const myFunction123 = (a: number, b: MyEnum) => {
    return 123;
};

export const myFunction456 = function*(a: number, b: MyEnum) {
    yield 123;
};