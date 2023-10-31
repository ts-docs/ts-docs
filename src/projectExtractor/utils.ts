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
    liscense?: string
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
        liscense: packageJSON.liscense
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
    return cp.execSync(`cd ${path} && git rev-parse --abbrev-ref HEAD`).slice(0, -1).toString("utf-8");
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
    else return TypeReferenceKind.Unknown;
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