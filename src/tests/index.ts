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

    addTest(generator: Generator, content: string, fnName?: string) : string {
        const current = generator.currentItem;
        if (!current) return "";
        const [filtered, full] = this.filterSource(content);
        if (current.kind === DeclarationTypes.CLASS) {
            if (this.classSuites.has(current)) this.classSuites.get(current)!.tests.push({functionName: fnName || "", testCode: full});
            else this.classSuites.set(current, {
                module: generator.currentModule,
                tests: [{functionName: fnName || "", testCode: full}]
            });
        } else if (current.kind === DeclarationTypes.FUNCTION) {
            this.fnSuites.push({functionName: current.name, testCode: full});
        }
        return filtered;
    }

    /**
     * If a line inside the codeblock starts with `#`, then that line is going to be omitted from the final output, but
     * it will be included in the test code. You can prevent this from happening by adding another `#` right after the 
     * first one.
     */
    filterSource(code: string) : [filtered: string, full: string] {
        let filtered = [];
        let full = [];
        for (const line of code.split("\n")) {
            if (line[0] === "#") {
                if (line[1] === "#") {
                    const sliced = line.slice(1);
                    filtered.push(sliced);
                    full.push(sliced);
                } else {
                    full.push(line.slice(1));
                }
            } else {
                filtered.push(line);
                full.push(line);
            }
        }
        return [filtered.join("\n"), full.join("\n")];
    }

    runClassSuites(generator: Generator) : void {
        for (const [cl, info] of this.classSuites) {
            console.log(cl.name, info.tests);
        }
    } 

}