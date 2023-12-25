import * as path from "path";
import * as cp from "child_process";
import * as fs from "fs";
import ts from "typescript";
import { TypeReferenceKind } from "./structure";

export interface PackageJSON {
    path: string,
    name?: string,
    version?: string,
    homepage?: string,
    repositoryBase?: string,
    description?: string,
    dependencies?: Record<string, string>,
    devDependencies?: Record<string, string>,
    readme?: string,
    license?: string,
    main?: string
}

export function getPackageJSON(basePath: string, gitBranch?: string) : PackageJSON | undefined {
    const finalPath = path.join(basePath, "package.json");
    if (!fs.existsSync(finalPath)) return;
    const packageJSON = JSON.parse(fs.readFileSync(finalPath, { encoding: "utf8" }));
    const readmePath = path.join(basePath, "README.md");
    return {
        path: finalPath,
        name: packageJSON.name,
        homepage: packageJSON.homepage,
        version: packageJSON.version,
        description: packageJSON.description,
        dependencies: packageJSON.dependencies,
        devDependencies: packageJSON.devDependencies,
        repositoryBase: getRepository(packageJSON.repository, basePath, gitBranch),
        readme: fs.existsSync(readmePath) ? fs.readFileSync(readmePath, { encoding: "utf8" }) : undefined,
        main: packageJSON.main,
        license: packageJSON.license
    };
}

export function getRepository(repositoryField: string | { type: string, url: string, directory?: string } | undefined, basePath: string, branchName?: string) : string|undefined {
    if (!repositoryField) return;
    const branch = branchName || getBranchName(basePath);
    if (typeof repositoryField === "string") {
        const [type, link] = repositoryField.split(":");
        return `https://${type}.com/${link}/tree/${branch}`;
    } else {
        // eslint-disable-next-line prefer-const
        let {type, url} = repositoryField;
        // eslint-disable-next-line no-useless-escape
        url = url.replace(new RegExp(`${type}:\/\/|ssh://${type}@`, "g"), "https://");
        return `${url.replace(new RegExp(`${type}\\+|\\.${type}`, "g"), "")}/tree/${branch}${repositoryField.directory || ""}`;
    }
}

export function getBranchName(path: string) : string|undefined {
    return cp.execSync(`cd ${path} && git rev-parse --abbrev-ref HEAD`).subarray(0, -1).toString("utf-8");
}

/**
 * Returns the absolute path and normalizes it.
 * - Separator gets set to "/"
 * - If the path ends with a "/", it gets omitted
 */
export function getAbsolutePath(relativePath: string, cwd?: string) : string {
    const absPath = ts.normalizeSlashes(path.isAbsolute(relativePath) ? relativePath : path.join(cwd || process.cwd(), relativePath));
    return absPath.endsWith("/") ? absPath.slice(0, -1) : absPath;
}

export function getFileNameFromPath(path: string, separator = "/") : string {
    return path.slice(path.lastIndexOf(separator) + separator.length);
}

/**
 * Resolves a name from "package.json" to the real name of the package. Example:
 * 
 * "@ts-docs/ts-docs" => "ts-docs"
 * "react" => "react"
 */
export function resolvePackageName(name: string) : string {
    if (name[0] === "@") return name.split("/")[1];
    else return name;
}

/**
 * Attempts to resolve the main file of a project. The name of the file
 * is taken from the "main" property in the `package.json` file, while the
 * path to it is taken from `tsconfig`'s `rootDir` property.
 * 
 * If the "main" property is missing, the function will assume the main file's name
 * is "index.ts".
 * 
 * If the "rootDir" property is missing, the function will check the root directory (`./`),
 * `./src` and `./lib` for the file.
 */
export function tryGetMainFile(basePath: string, tsconfig: ts.CompilerOptions, packageJSON?: PackageJSON) : string | undefined {
    let name = "index.ts";
    if (packageJSON && packageJSON.main) {
        const fileName = packageJSON.main.slice(packageJSON.main.lastIndexOf("/") + 1);
        name = fileName.includes(".") ? fileName.split(".")[0] + ".ts" : fileName;
    }
    
    if (tsconfig.rootDir) {
        const fullPath = ts.normalizeSlashes(path.join(basePath, tsconfig.rootDir, name));
        if (fs.existsSync(fullPath)) return fullPath;
    }

    const attemptOne = ts.normalizeSlashes(path.join(basePath, "./", name));
    if (fs.existsSync(attemptOne)) return attemptOne;
    const attemptTwo = ts.normalizeSlashes(path.join(basePath, "./src", name));
    if (fs.existsSync(attemptTwo)) return attemptTwo;
    const attemptThree = ts.normalizeSlashes(path.join(basePath, "./lib", name));
    if (fs.existsSync(attemptThree)) return attemptTwo;
    return undefined;
}

export function getTsconfig(basePath: string) : ts.ParsedCommandLine | undefined {
    const configPath = ts.findConfigFile(basePath, ts.sys.fileExists, "tsconfig.json");
    if (!configPath) return;
    return ts.parseConfigFileWithSystem(configPath, {}, undefined, undefined, ts.sys, () => undefined);
}

export function joinPartOfArray(array: Array<string>, endAt: number, separator: string) : string {
    let result = array[0] || "";
    for (let i=1; i < endAt; i++) {
        result += separator + array[i]; 
    }
    return result;
}

export function hasModifier(node: ts.HasModifiers, modifier: ts.SyntaxKind) : boolean | undefined {
    return node.modifiers?.some(mod => mod.kind === modifier);
}

export function mapRealValues<T, K>(array: readonly T[] | undefined, cb: (item: T) => K | undefined) : K[] {
    const newArray: K[] = [];
    for (const value of (array || [])) {
        const mapped = cb(value);
        if (mapped) newArray.push(mapped);
    }
    return newArray;
}

export function getSymbolDeclaration(sym: ts.Symbol) : ts.Declaration | undefined {
    return sym.valueDeclaration || sym.declarations?.[0];
}

export function getSymbolTypeKind(symbol: ts.Symbol) : TypeReferenceKind {
    if (BitField.has(symbol.flags, ts.SymbolFlags.Class)) return TypeReferenceKind.Class;
    else if (BitField.has(symbol.flags, ts.SymbolFlags.Interface)) return TypeReferenceKind.Interface;
    else if (BitField.has(symbol.flags, ts.SymbolFlags.TypeAlias)) return TypeReferenceKind.TypeAlias;
    else if (BitField.has(symbol.flags, ts.SymbolFlags.ConstEnum) || BitField.has(symbol.flags, ts.SymbolFlags.RegularEnum)) return TypeReferenceKind.Enum;
    else if (BitField.has(symbol.flags, ts.SymbolFlags.EnumMember)) return TypeReferenceKind.EnumMember;
    else if (BitField.has(symbol.flags, ts.SymbolFlags.Function)) return TypeReferenceKind.Function;
    else if (BitField.has(symbol.flags, ts.SymbolFlags.Variable) && !BitField.has(symbol.flags, ts.SymbolFlags.FunctionScopedVariable)) return TypeReferenceKind.Constant;
    else return TypeReferenceKind.Unknown;
}

export function isNamespaceSymbol(symbol: ts.Symbol) : boolean {
    return symbol.declarations?.length === 1 && symbol.declarations[0].kind === ts.SyntaxKind.ModuleDeclaration;
}

export class BitField {
    bits: number;
    constructor(bits: Array<number|undefined|false>) {
        this.bits = 0;
        this.set(...BitField.resolve(bits));
    }

    has(bit: number) : boolean {
        return (this.bits & bit) === bit;
    }

    set(...bits: Array<number|undefined|false>) {
        for (const bit of BitField.resolve(bits)) {
            this.bits |= bit;
        }
    }

    remove(...bits: Array<number|undefined|false>) {
        let total = 0;
        for (const bit of BitField.resolve(bits)) {
            total |= bit;
        }
        this.bits &= ~total;
    }

    toJSON() : number {
        return this.bits;
    }

    static resolve(bits: Array<number|undefined|false>) : number[] {
        return bits.filter(b => b !== undefined && b !== false) as number[];
    }

    static has(bitfield: number, bit: number) : boolean {
        return (bitfield & bit) !== 0;
    }
}