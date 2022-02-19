import ts from "typescript";
import path from "path";

export function importResolver(dir: string) : ts.TransformerFactory<ts.SourceFile> {
    return (ctx) => {
        const newImports: Array<ts.Statement> = [];
        return (node) => {
            const visitor = (node: ts.Node) : ts.Node | undefined => {
                if (ts.isImportDeclaration(node)) {
                    const specifier = node.moduleSpecifier;
                    if (!ts.isStringLiteral(specifier)) return;
                    const newSpecifier = path.isAbsolute(specifier.text) ? specifier.text : path.join(dir, specifier.text);
                    newImports.push(ts.factory.updateImportDeclaration(node, node.decorators, node.modifiers, node.importClause, ts.factory.createStringLiteral(newSpecifier), node.assertClause));
                    return undefined;
                }
                return ts.visitEachChild(node, visitor, ctx);
            };
            node = ts.visitEachChild(node, visitor, ctx);
            return ts.factory.updateSourceFile(node, [...newImports, ...node.statements]);
        };
    };
}
