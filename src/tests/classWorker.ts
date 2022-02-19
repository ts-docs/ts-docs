
import ts from "typescript";
import { workerData } from "worker_threads";
import { TestFnRange } from ".";
import { importResolver } from "./importResolver";

const data = workerData as {
    code: string,
    ranges: Array<TestFnRange>,
    tsconfig: ts.CompilerOptions,
    className: string,
    dir: string
}

const formatHost: ts.FormatDiagnosticsHost = {
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => "\n",
    getCanonicalFileName: (fileName: string) => fileName
}

const {diagnostics, outputText} = ts.transpileModule(data.code, {
    reportDiagnostics: true, 
    compilerOptions: {...data.tsconfig, rootDir: undefined},
    transformers: {
        before: [importResolver(data.dir)]
    }
});

if (diagnostics && diagnostics.length) {
    for (const dia of diagnostics) {
        const start = dia.start || Infinity;
        const inFn = data.ranges.find(r => start > r.start && start < r.end);
        if (inFn) dia.messageText = `In method \x1b[31m${data.className}${inFn.fnName ? `.${inFn.fnName}`:""}\x1b[0m: ${dia.messageText}`;
        else dia.messageText = `In class \x1b[31m${data.className}\x1b[0m: ${dia.messageText}`;
    }
    console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost));
}
else eval(outputText);