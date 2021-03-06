
import { JSDocData, JSDocTag, ExternalReference, Declaration, DeclarationTypes } from "@ts-docs/extractor";
import fs from "fs";
import path from "path";
import ts from "typescript";
import fetch from "got";
import { OptionSource } from "..";
import { cyan, red, yellow } from "./formatter";

/**
 * Finds a `tsconfig.json` file, starting from `basePath` and going up.
 */
export function findTSConfig(basePath: string) : { compilerOptions: ts.CompilerOptions, tsdocsOptions?: OptionSource } | undefined {
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

const ESCAPE_CHARS = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
};

export function escapeHTML(html: string) : string {
    return html.replace(/[&<>'"]/g, (thing) => ESCAPE_CHARS[thing as never]);
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
            /** Javascript / Node.js global objects */
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
            case "Capitalize": return { link: "https://www.typescriptlang.org/docs/handbook/utility-types.html#capitalizestringtype" };
            case "Uncapitalize": return { link: "https://www.typescriptlang.org/docs/handbook/utility-types.html#uncapitalizestringtype" };
            case "Uppercase": return { link: "https://www.typescriptlang.org/docs/handbook/utility-types.html#uppercasestringtype" };
            case "Lowercase": return { link: "https://www.typescriptlang.org/docs/handbook/utility-types.html#lowercasestringtype" };
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
                    case "ReadableStream": return { link: "https://nodejs.org/api/stream.html#class-streamreadable", name: "NodeJS", displayName: "ReadableStream" };
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
        },
        {
            baseName: "url",
            run: (name) => {
                switch (name) {
                case "URL": return { link: "https://nodejs.org/api/url.html#class-url", name: "URL" };
                default: return;
                }
            }
        }
    ];
}

export interface ChangelogData {
    url: string,
    authorName: string,
    authorUrl: string,
    content: string,
    publishedAt: string,
    downloadZip: string,
    downloadTar: string,
    tagName: string
}

export async function fetchChangelog(githubLink: string) : Promise<ChangelogData|undefined> {
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

export function getComment(node: { jsDoc?: Array<JSDocData> }, limit = 128) : string|undefined {
    const comment = node.jsDoc?.[0]?.comment;
    if (comment) {
        if (comment.length > limit) return comment.slice(0, limit) + "...";
        return comment;
    }
    return;
}

export function getTag(node: Declaration, tagName: string) : Array<JSDocTag> {
    const tags = node.jsDoc?.[0] ? node.jsDoc[0].tags.filter(t => t.name === tagName) : [];
    if (node.kind === DeclarationTypes.FUNCTION) {
        for (const sig of node.signatures) {
            if (sig.jsDoc?.[0]) tags.push(...sig.jsDoc[0].tags.filter(t => t.name === tagName));
        }
    }
    return tags;
}

export function getColoredMessage(pre: string, text: TemplateStringsArray, ...exps: Array<string>) : string {
    let i = 0;
    let final = "";
    for (const str of text) {
        final += `${str}${exps[i] ? cyan(exps[i++]) : ""}`;
    }
    return `${pre}: ${final}`;
}

export function emitWarning(text: TemplateStringsArray, ...exps: Array<string>) : void {
    console.warn(getColoredMessage(yellow("[Warning]"), text, ...exps));
}

export function emitNotification(text: TemplateStringsArray, ...exps: Array<string>) : void {
    console.log(getColoredMessage(cyan("[Notification]"), text, ...exps));
}

export function emitError(text: TemplateStringsArray, ...exps: Array<string>) : void {
    console.error(getColoredMessage(red("[Error]"), text, ...exps));
    process.exit();
}