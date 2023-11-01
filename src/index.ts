/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unused-vars */
//import * as ts from "typescript";
import fs from "fs";
import { TypescriptExtractor, TypescriptExtractorHooks } from "./projectExtractor/extractor";
import { HookManager } from "./projectExtractor/hookManager";
import perf from "perf_hooks";

const myHooks = new HookManager<TypescriptExtractorHooks>();

myHooks.attach("resolveExternalLink", (extractor, typeName, typeKind, typeLib, typeExtra) => {
    //console.log(typeName.name, typeKind, typeLib, typeExtra);
    return undefined;
});

const before = perf.performance.now();
const myExtractor = TypescriptExtractor.createStandaloneExtractor("./", { passthroughModules: ["src", "inner"] }, myHooks);
console.log(`Extraction took ${perf.performance.now() - before}ms`);

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
    t?: MyNamespace.NestedNamespace.Getters<T>;
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

export interface ReferenceType {
    a(a: number, b: string) : unknown;
    b: (a: number, b: string) => unknown;
}


if (myExtractor) {
    console.log(myExtractor.toJSON());
    fs.writeFileSync("./data.json", JSON.stringify(myExtractor));
}


export const NUM_CONST = 123;

export namespace MyNamespace {

    export const myFunction123 = (a: number, b: MyEnum) => {
        return 123;
    };
    
    export const myFunction456 = function*(a: number, b: MyEnum) {
        yield 123;
    };
    
}

export namespace MyNamespace {


    export type ReturnType1<T> = T extends (...args: unknown[]) => infer R ? R : ReturnType1<T>;

    export namespace NestedNamespace {

        export type Getters<Type> = {
            [Property in keyof Type as `get${Capitalize<string & Property>}`]: () => Type[Property]
        };
    }
    
}