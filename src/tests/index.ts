import { ClassDecl, DeclarationTypes, Module } from "@ts-docs/extractor";
import { Generator } from "..";
import { Worker } from "worker_threads";
import path from "path";

export interface TestSuite {
    functionName: string,
    testCode: string
}

export interface TestFnRange {
    start: number,
    end: number,
    fnName: string
}

export class TestCollector {
    classSuites: Map<ClassDecl, Array<TestSuite>>;
    classMods: Map<ClassDecl, Module>;
    fnSuites: Array<TestSuite>;

    constructor() {
        this.classSuites = new Map();
        this.classMods = new Map();
        this.fnSuites = [];
    }

    addTest(generator: Generator, content: string, fnName?: string) : string {
        const current = generator.currentItem;
        if (!current) return "";
        const [filtered, full] = this.filterSource(content);
        if (current.kind === DeclarationTypes.CLASS) {
            if (!this.classMods.has(current)) this.classMods.set(current, generator.currentModule);
            if (this.classSuites.has(current)) this.classSuites.get(current)!.push({functionName: fnName || "", testCode: full});
            else this.classSuites.set(current, [{functionName: fnName || "", testCode: full}]);
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
        const output = generator.tsconfig.outDir;
        if (!output) return;
        for (const [cl, methods] of this.classSuites) {
            const module = this.classMods.get(cl)!;
            const dir = path.join(process.cwd(), output, ...module.path).replace(/\\/g, "/");
            const filename = `${dir}/${cl.loc.filename!.replace(".ts", ".js")}`
            let finalScript = 
`${module.name !== "default" ? `const { ${cl.name} } = require("${filename}")` : ""}
const assert = require("assert");
`;
            const methodRanges: Array<TestFnRange> = [];
            for (const method of methods) {
                const loc: TestFnRange = { start: finalScript.length, fnName: method.functionName, end: 0 };
                finalScript += `(async () => {
                    try {
                        ${method.testCode}
                    } catch(err) {
                        console.error("🛑 Documentation test error in \x1b[31m${cl.name}.${method.functionName}\x1b[0m: ");
                        console.error(err);
                    }
                })();`;
                loc.end += finalScript.length;
                methodRanges.push(loc);
            }

            new Worker(`${__dirname}/worker.js`, { workerData: {
                tsconfig: generator.tsconfig,
                className: cl.name,
                ranges: methodRanges,
                code: finalScript,
                dir
            }});
        }
    } 

}