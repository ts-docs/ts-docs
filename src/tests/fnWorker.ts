
import ts from "typescript";
import { workerData } from "worker_threads";
import { TestFnRange } from ".";
import { importResolver } from "./importResolver";
import { formatErrorObj as __formatErrorObj, formatError, red, cyan } from "../utils/formatter";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const formatErrorObj = __formatErrorObj;

const data = workerData as {
    code: string,
    ranges: Array<TestFnRange>,
    tsconfig: ts.CompilerOptions,
    fnName: string,
    dir: string
};

const {diagnostics, outputText} = ts.transpileModule(data.code, {
    reportDiagnostics: true, 
    compilerOptions: {...data.tsconfig, rootDir: undefined},
    transformers: {
        before: [importResolver(data.dir)]
    }
});

if (diagnostics && diagnostics.length) {
    for (const dia of diagnostics) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const { line, character } = ts.getLineAndCharacterOfPosition(dia.file!, dia.start || 0);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const ends = ts.getLineAndCharacterOfPosition(dia.file!, dia.length || 0);
        const start = dia.start || Infinity;
        const inFn = data.ranges.find(r => start > r.start && start < r.end);
        console.error(formatError({
            line: line,
            col: character,
            endCol: ends.character,
            endLine: ends.line,
            content: data.code,
            filename: data.dir,
            name: "TypescriptError",
            message: dia.messageText.toString(),
            additionalMessage: inFn ? `${red("in")} ${cyan(`${inFn.fnName} (${inFn.pos.line}:${inFn.pos.character}`)}` : undefined
        }));
    }
}
else eval(outputText);