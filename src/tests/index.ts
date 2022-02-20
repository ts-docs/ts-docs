/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ClassDecl, DeclarationTypes, FunctionDecl, Module, Project } from "@ts-docs/extractor";
import { Generator } from "..";
import { Worker } from "worker_threads";
import path from "path";
import ts from "typescript";
import { red, cyan } from "../utils/formatter";

export interface TestFnRange {
    start: number,
    end: number,
    fnName?: string,
    path: string,
    pos: ts.LineAndCharacter
}

export class TestCollector {
    classSuites: Map<ClassDecl, {
        project: Project,
        module: Module,
        tests: Array<{ functionName?: string, testCode: string }>
    }>;
    fnSuites: Map<Module, {
        project: Project,
        tests: Map<FunctionDecl, Array<string>>
    }>;
    constructor() {
        this.classSuites = new Map();
        this.fnSuites = new Map();
    }

    addTest(generator: Generator, content: string, fnName?: string): string {
        const current = generator.currentItem;
        if (!current) return content;
        if (generator.settings.test) {
            const doc = generator.settings.test.split(".");
            if (doc.length === 2) {
                if (doc[0] !== current.name || fnName !== doc[1]) return content;
            } else if (doc[0] !== fnName && doc[0] !== current.name) return content;
        }
        const [filtered, full] = this.filterSource(content);
        if (current.kind === DeclarationTypes.CLASS) {
            if (this.classSuites.has(current)) this.classSuites.get(current)!.tests.push({ functionName: fnName, testCode: full });
            else this.classSuites.set(current, {
                project: generator.currentProject,
                module: generator.currentModule,
                tests: [{ functionName: fnName, testCode: full }]
            });
        } else if (current.kind === DeclarationTypes.FUNCTION) {
            const fnSuite = this.fnSuites.get(generator.currentModule);
            if (fnSuite) {
                if (fnSuite.tests.has(current)) fnSuite.tests.get(current)!.push(full);
                else fnSuite.tests.set(current, [full]);
            } else this.fnSuites.set(generator.currentModule, {
                project: generator.currentProject,
                tests: new Map([[current, [full]]])
            });
        }
        return filtered;
    }

    /**
     * If a line inside the codeblock starts with `#`, then that line is going to be omitted from the final output, but
     * it will be included in the test code. You can prevent this from happening by adding another `#` right after the 
     * first one.
     */
    filterSource(code: string): [filtered: string, full: string] {
        const filtered = [];
        const full = [];
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

    runClassSuites(generator: Generator): void {
        for (const [cl, { module, tests, project }] of this.classSuites) {
            if (!project.tsconfig || !project.tsconfig.outDir) continue;
            const dir = path.join(project.root, project.tsconfig.outDir, ...(generator.projects.length === 1 ? module.path : module.path.slice(1))).replace(/\\/g, "/");
            const filename = `${dir}/${cl.loc.filename!.replace(".ts", ".js")}`;
            let finalScript =
                `${module.name !== "default" ? `const { ${cl.name} } = require("${filename}");` : ""}const assert = require("assert");(async () => {
`;
            const methodRanges: Array<TestFnRange> = [];
            for (const method of tests) {
                const loc: TestFnRange = { start: finalScript.length, fnName: method.functionName, end: 0, pos: cl.loc.pos, path: filename };
                finalScript += `try {
    ${method.testCode}\n
                } catch(err) {
                    console.error(formatErrorObj(err, {
                        filename: "${filename}",
                        content: outputText,
                        additionalMessage: "${red("in")} ${cyan(cl.name + (method.functionName ? `.${method.functionName}` : ""))} (${cl.loc.pos.line}:${cl.loc.pos.character})"
                    }));
                }`;
                loc.end += finalScript.length;
                methodRanges.push(loc);
            }
            new Worker(`${__dirname}/classWorker.js`, {
                workerData: {
                    tsconfig: project.tsconfig,
                    className: cl.name,
                    ranges: methodRanges,
                    code: finalScript + "})();",
                    dir
                }
            });
        }
    }

    runFnSuites(generator: Generator): void {
        for (const [module, { project, tests }] of this.fnSuites) {
            if (!project.tsconfig || !project.tsconfig.outDir) continue;
            const dir = path.join(project.root, project.tsconfig.outDir, ...(generator.projects.length === 1 ? module.path : module.path.slice(1))).replace(/\\/g, "/");
            let finalScript = "const assert = require(\"assert\");(async () => {";
            const ranges: Array<TestFnRange> = [];
            for (const [fnDecl, codes] of tests) {
                const filename = `${dir}/${fnDecl.loc.filename!.replace(".ts", ".js")}`;
                const loc: TestFnRange = { start: finalScript.length, fnName: fnDecl.name, end: 0, pos: fnDecl.loc.pos, path: filename };
                if (fnDecl.name !== "default") finalScript += `const { ${fnDecl.name} } = require("${filename}");`;
                for (const code of codes) {
                    finalScript += `try {
    ${code}\n
                    } catch(err) {
                        console.error(formatErrorObj(err, {
                            filename: "${filename}",
                            content: outputText,
                            additionalMessage: "${red("in")} ${cyan(fnDecl.name)} (${fnDecl.loc.pos.line}:${fnDecl.loc.pos.character})"
                        }));
                    }`;
                }
                loc.end = finalScript.length;
                ranges.push(loc);
            }
            new Worker(`${__dirname}/fnWorker.js`, {
                workerData: {
                    tsconfig: project.tsconfig,
                    ranges,
                    code: finalScript += "})();",
                    dir
                }
            });
        }
    }

}