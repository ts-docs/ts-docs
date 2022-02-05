import { ClassDecl } from "@ts-docs/extractor";
import ts from "typescript";

export interface TestSuite {
    functionName: string,
    testCode: string
}

export class TestCollector {
    classSuites: Map<ClassDecl, TestSuite>;
    fnSuites: Array<TestSuite>;

    constructor() {
        this.classSuites = new Map();
        this.fnSuites = [];
    }

}