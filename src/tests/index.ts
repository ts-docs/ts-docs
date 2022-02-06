import { ClassDecl, DeclarationTypes, Module } from "@ts-docs/extractor";
import ts from "typescript";
import { Generator } from "..";

export interface TestSuite {
    functionName: string,
    testCode: string
}

export class TestCollector {
    classSuites: Map<ClassDecl, {
        module: Module,
        tests: Array<TestSuite>
    }>;
    fnSuites: Array<TestSuite>;

    constructor() {
        this.classSuites = new Map();
        this.fnSuites = [];
    }

    addTest(generator: Generator, content: string, fnName?: string) : void {
        const current = generator.currentItem;
        if (!current) return;
        if (current.kind === DeclarationTypes.CLASS) {
            if (this.classSuites.has(current)) this.classSuites.get(current)!.tests.push({functionName: fnName || "", testCode: content});
            else this.classSuites.set(current, {
                module: generator.currentModule,
                tests: [{functionName: fnName || "", testCode: content}]
            });
        } else if (current.kind === DeclarationTypes.FUNCTION) {
            this.fnSuites.push({functionName: current.name, testCode: content});
        }
    }

    runClassSuites(generator: Generator) : void {
        for (const [cl, info] of this.classSuites) {
            console.log(cl.name, info.tests);
        }
    } 

}