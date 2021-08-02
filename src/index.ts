
import parseArgs from "minimist";

export interface TsDocsArgs {
     "--": Array<string>,
     _: Array<string>,
     help?: boolean,
     landingPage?: string,
     struct?: string
}

const args = parseArgs(process.argv.slice(2)) as TsDocsArgs;

if (args.help) {
    console.log(
        `──── ts-docs help ────

Usage: ts-docs [...entryFiles]


-struct ─ The documentation structure to use. The default one is used by default.
-landingPage ─ Which module to act as the landing page. 
`);
}

if (args._.length === 0) throw new Error("Expected at least one entry file.");

