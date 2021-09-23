
import { ArrayType, ArrowFunction, FunctionParameter, JSDocData, Literal, ObjectLiteral, Property, Reference, Tuple, Type, TypeKinds, TypeOperator, UnionOrIntersection, JSDocTag } from "@ts-docs/extractor";
import fs from "fs";
import path from "path";
import ts from "typescript";

/**
 * Creates a file with the name `file`, which is located inside `folder`, which gets created if it doesn't
 * exist. The `folder` is located in the `basePath`.
 */
export function createFile(basePath: string, folder: string, file: string, content: string) : string {
    const folderPath = path.join(basePath, folder);
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);
    fs.writeFileSync(path.join(folderPath, file), content, "utf-8");
    return folderPath;
}

/**
 * Finds a `tsconfig.json` file, starting from `basePath` and going up.
 */
export function findTSConfig<T = string>(basePath: string) : Record<string, T>|undefined {
    const p = path.join(basePath, "tsconfig.json");
    if (fs.existsSync(p)) return ts.parseConfigFileTextToJson("tsconfig.json", fs.readFileSync(p, "utf-8")).config;
    const newPath = path.join(basePath, "../");
    if (basePath === newPath) return undefined;
    return findTSConfig(newPath);
}

export function findTsDocsJs<T = string>(basePath: string) : Record<string, T>|undefined {
    const p = path.join(basePath, "tsDocs.config.js");
    if (!fs.existsSync(p)) return undefined;
    return require(p);
} 

/**
 * Copies an entire folder and everything inside it.
 */
export function copyFolder(origin: string, destination: string) : void {
    for (const file of fs.readdirSync(origin, {withFileTypes: true})) {
        const newOrigin = path.join(origin, file.name);
        const newDestination = path.join(destination, file.name);
        if (file.isDirectory()) {
            const dest = path.join(process.cwd(), newDestination);
            if (!fs.existsSync(dest)) fs.mkdirSync(path.join(process.cwd(), newDestination));
            copyFolder(newOrigin, newDestination);
        }
        else fs.copyFileSync(newOrigin, newDestination);
    }
}

/**
 * Escapes ampersands, less-than and greater-than characters from a string.
 */
export function escapeHTML(html: string) : string {
    return html.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;") ;
}

/**
 * Gets how long a type is. Used for deciding if a fucntion should be on multiple lines.
 */
export function getTypeLength(type?: Type) : number {
    if (!type) return 0;
    switch (type.kind) {
    case TypeKinds.REFERENCE: return (type as Reference).type.name.length + ((type as Reference).typeArguments?.reduce((acc, t) => acc + getTypeLength(t), 0) || 0) + ((type as Reference).type.displayName?.length || 0);
    case TypeKinds.OBJECT_LITERAL: return (type as ObjectLiteral).properties.reduce((acc, prop) => acc + (("key" in prop) ? getTypeLength(prop.type) : ((prop as Property).name.length + getTypeLength((prop as Property).type))), 0);
    case TypeKinds.ARROW_FUNCTION: {
        const fn = (type as ArrowFunction);
        let total = getTypeLength(fn.returnType);
        if (fn.parameters) {
            for (const param of fn.parameters) {
                total += param.name.length;
                if (param.defaultValue) total += getTypeLength(param.defaultValue);
                if (param.type) total += getTypeLength(param.type);
                if (param.rest) total += 3;
            }
        }
        return total;
    }
    case TypeKinds.INTERSECTION:
    case TypeKinds.UNION:
        return (type as UnionOrIntersection).types.reduce((acc, t) => acc + getTypeLength(t), 0);
    case TypeKinds.STRING_LITERAL:
    case TypeKinds.NUMBER_LITERAL:
    case TypeKinds.STRINGIFIED_UNKNOWN: return (type as Literal).name.length;    
    case TypeKinds.ARRAY_TYPE: return getTypeLength((type as ArrayType).type);
    case TypeKinds.TRUE: return 4;
    case TypeKinds.FALSE: return 5;
    case TypeKinds.STRING:
    case TypeKinds.NUMBER: return 6;
    case TypeKinds.BOOLEAN:
    case TypeKinds.UNKNOWN: return 7;
    case TypeKinds.BIGINT: return 6;
    case TypeKinds.TUPLE: return (type as Tuple).types.reduce((acc, t) => acc + getTypeLength(t), 0);
    case TypeKinds.TYPEOF_OPERATOR:
    case TypeKinds.KEYOF_OPERATOR:
    case TypeKinds.UNIQUE_OPERATOR:
    case TypeKinds.READONLY_OPERATOR:
        return getTypeLength((type as TypeOperator).type);
    default: return 0;
    }
}

/**
 * Gets how long a type signature is. Used for deciding if a fucntion should be on multiple lines.
 */
export function isLargeSignature(sig: { parameters?: Array<FunctionParameter>, returnType?: Type }) : boolean {
    if (sig.parameters) {
        if (sig.parameters.length > 3) return true;
        const total = sig.parameters.reduce((acc, param) => acc + param.name.length + getTypeLength(param.type) + getTypeLength(param.defaultValue), getTypeLength(sig.returnType));
        if (total > 65) return true;
    }
    return false;
}

export function isLargeObject(obj: ObjectLiteral) : boolean {
    if (obj.properties.length > 3) return true;
    return getTypeLength(obj) > 48;
}

export function getTagFromJSDoc(searchFor: string, doc: Array<JSDocData>) : JSDocTag|undefined {
    for (const jsdoc of doc) {
        if (!jsdoc.tags) continue;
        const tag = jsdoc.tags.find(t => t.name === searchFor);
        if (tag) return tag;
    }
    return;
}

export function hasTagFromJSDoc(searchFor: string, doc: Array<JSDocData>) : boolean {
    for (const jsdoc of doc) {
        if (jsdoc.tags && jsdoc.tags.some(t => t.name === searchFor)) return true;
    }
    return false;
}

export function getPathFileName(p?: string) : string|undefined {
    if (!p) return;
    return path.parse(p).name;
}