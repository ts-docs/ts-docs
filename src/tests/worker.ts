
import path from "path";
import ts from "typescript";
import { workerData } from "worker_threads";
import { TestFnRange } from ".";

const data = workerData as {
    code: string,
    ranges: Array<TestFnRange>,
    tsconfig: ts.CompilerOptions,
    className: string,
    dir: string
}

const importResolver: ts.TransformerFactory<ts.SourceFile> = (ctx) => {
    const newImports: Array<ts.Statement> = [];
    return (node) => {
        const visitor = (node: ts.Node) : ts.Node | undefined => {
            if (ts.isImportDeclaration(node)) {
                const specifier = node.moduleSpecifier;
                if (!ts.isStringLiteral(specifier)) return;
                const newSpecifier = path.isAbsolute(specifier.text) ? specifier.text : path.join(data.dir, specifier.text);
                newImports.push(ts.factory.updateImportDeclaration(node, node.decorators, node.modifiers, node.importClause, ts.factory.createStringLiteral(newSpecifier), node.assertClause));
                return undefined;
            }
            return ts.visitEachChild(node, visitor, ctx);
        }
        node = ts.visitEachChild(node, visitor, ctx);
        return ts.factory.updateSourceFile(node, [...newImports, ...node.statements]);
    }
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
        before: [importResolver]
    }
});

if (diagnostics && diagnostics.length) {
    for (const dia of diagnostics) {
        const start = dia.start || Infinity;
        const inFn = data.ranges.find(r => start > r.start && start < r.end);
        if (inFn) dia.messageText = `In ${data.className}.${inFn.fnName}: ${dia.messageText}`;
        else dia.messageText = `In ${data.className}: ${dia.messageText}`;
    }
    console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost));
}
else eval(outputText);