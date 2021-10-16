
import { ArrayType, ArrowFunction, FunctionParameter, JSDocData, Literal, ObjectLiteral, Reference, Tuple, Type, TypeKinds, TypeOperator, UnionOrIntersection, JSDocTag, ExternalReference } from "@ts-docs/extractor";
import fs from "fs";
import path from "path";
import ts from "typescript";
import fetch from "got";

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
    const p = path.join(basePath, "tsdocs.config.js");
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
            if (!fs.existsSync(newDestination)) fs.mkdirSync(newDestination);
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
    case TypeKinds.OBJECT_LITERAL: {
        const t = type as ObjectLiteral;
        return t.properties.reduce((prev, curr) => {
            if (curr.prop) return prev + (curr.prop.rawName.length + (curr.prop.type ? getTypeLength(curr.prop.type) : 0));
            else if (curr.index) return prev + 2 + (getTypeLength(curr.index.type) + (curr.index.key ? getTypeLength(curr.index.key) : 0));
            else return 100;
        }, 0);
    }
    case TypeKinds.ARROW_FUNCTION: {
        const fn = type as ArrowFunction;
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
        if (total > 32) return true;
    }
    return false;
}

export function isLargeObject(obj: ObjectLiteral) : boolean {
    if (obj.properties.length > 3 || obj.properties.some(prop => prop.call || prop.construct)) return true;
    return getTypeLength(obj) > 42;
}

export function isLargeArr(arr: Array<Type>) : boolean {
    if (arr.length > 4) return true;
    return arr.reduce((acc, t) => acc + getTypeLength(t), 0) > 42;
}

export function getTagFromJSDoc(searchFor: string, doc: Array<JSDocData>) : JSDocTag|undefined {
    for (const jsdoc of doc) {
        if (!jsdoc.tags) continue;
        const tag = jsdoc.tags.find(t => t.name === searchFor);
        if (tag) return tag;
    }
    return;
}

export function getPathFileName(p?: string) : string|undefined {
    if (!p) return;
    return path.parse(p).name;
}

export function handleDefaultAPI() : ExternalReference {
    return {
        run: (sym, source) => {
            if (source) return;
            switch (sym) {
            /** Javascript global objects */
            case "Date": return { link: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date"};
            case "Bigint": return { link: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt" };
            case "Promise": return { link: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise" }; 
            case "Set": return { link: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set" };
            case "Map": return { link: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map" };
            case "WeakMap": return { link: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap" };
            case "WeakSet": return { link: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakSet" };
            case "Generator": return { link: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator" };
            case "URL": return { link: "https://developer.mozilla.org/en-US/docs/Web/API/URL/URL" };
            case "Buffer": return { link: "https://nodejs.org/api/buffer.html" };
            case "RegExp": return { link: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp" };
            case "Array": return { link: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array" }; 
            case "Function": return { link: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function" };
            case "Symbol": return { link: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol" };
            case "Error": return { link: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error" };
            case "URLSearchParams": return { link: "https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams" };
            case "ArrayBuffer": return { link: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer" };
            case "Infinity": return { link: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Infinity" };
            /** Typescript types */
            case "Record": return { link: "https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeystype" };
            case "Omit": return { link: "https://www.typescriptlang.org/docs/handbook/utility-types.html#omittype-keys" };
            case "Pick": return { link: "https://www.typescriptlang.org/docs/handbook/utility-types.html#picktype-keys" };
            case "ReadonlyArray": return { link: "https://www.typescriptlang.org/docs/handbook/2/objects.html#the-readonlyarray-type" };
            case "Iterable": return { link: "https://www.typescriptlang.org/docs/handbook/iterators-and-generators.html#iterable-interface" };
            case "IterableIterator": return { link: "https://www.typescriptlang.org/docs/handbook/iterators-and-generators.html" };
            case "Partial": return { link: "https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype" };
            case "Required": return { link: "https://www.typescriptlang.org/docs/handbook/utility-types.html#requiredtype" };
            case "Readonly": return { link: "https://www.typescriptlang.org/docs/handbook/utility-types.html#readonlytype" };
            case "Exclude": return { link: "https://www.typescriptlang.org/docs/handbook/utility-types.html#excludetype-excludedunion" };
            case "Extract": return { link: "https://www.typescriptlang.org/docs/handbook/utility-types.html#extracttype-union" };
            case "NonNullable": return { link: "https://www.typescriptlang.org/docs/handbook/utility-types.html#nonnullabletype" };
            default: return;         
            }
        }
    };
}

export function handleNodeAPI() : Array<ExternalReference> {
    return [
        {
            run: (name) => {
                if (name.startsWith("NodeJS")) {
                    const [, obj] = name.split(".");
                    switch(obj) {
                    case "Timeout": return { link: "https://nodejs.org/api/timers.html#timers_class_timeout", name: "NodeJS", displayName: "Timeout" };
                    case "Process": return { link: "https://nodejs.org/api/process.html", name: "NodeJS", displayName: "Process" };
                    case "WriteStream": return { link: "https://nodejs.org/api/stream.html#stream_class_stream_writable", name: "NodeJS", displayName: "WriteStream"};
                    case "EventEmitter": return { link: "https://nodejs.org/api/events.html#events_class_eventemitter", name: "NodeJS", displayName: "EventEmitter" };
                    default: return;
                    }
                }
                return;
            }
        },
        {
            baseName: "events",
            run: (name) => {
                switch (name) {
                case "EventEmitter": return { link: "https://nodejs.org/api/events.html#events_class_eventemitter", name: "NodeJS", displayName: "EventEmitter" };
                default: return;
                }
            }
        }
    ];
}

export async function fetchChangelog(githubLink: string) : Promise<{
    url: string,
    authorName: string,
    authorUrl: string,
    content: string,
    publishedAt: string,
    downloadZip: string,
    downloadTar: string,
    tagName: string
}|undefined> {
    const sliced = githubLink.slice(githubLink.indexOf("github.com/") + 11, githubLink.includes("/tree/") ? githubLink.indexOf("/tree/") : undefined);
    if (!sliced) return;
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await fetch(`https://api.github.com/repos/${sliced}/releases/latest`).json() as any;
        if (data.message) return;
        return {
            authorName: data.author.login,
            authorUrl: data.author.html_url,
            url: data.url,
            content: data.body,
            publishedAt: new Date(data.published_at).toLocaleString("en-GB"),
            downloadZip: data.tarball_url,
            downloadTar: data.zipball_url,
            tagName: data.name || data.tag_name
        };
    } catch {
        return;
    }
}

export function getComment(node: { jsDoc?: Array<JSDocData> }) : string|undefined {
    const comment = node.jsDoc?.[0]?.comment;
    if (comment) {
        if (comment.length > 128) return comment.slice(0, 128) + "...";
        return comment;
    }
    return;
}