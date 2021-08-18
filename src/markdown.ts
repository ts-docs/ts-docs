
import { TypescriptExtractor } from "@ts-docs/extractor";
import highlight from "highlight.js";
import marked from "marked";
import { Generator } from "./generator";

declare module "marked" {

    export interface MarkedExtension {
        extensions?: Array<{
            name: string,
            level: string,
            start: (src: string) => number|boolean|undefined,
            tokenizer: (src: string) => {type: string, raw: string, text: string, before: string}|undefined,
            renderer: (token: {type: string, raw: string, text: string, before: string}) => string
        }>
    }
}

export function initMarkdown(generator: Generator, firstExtractor: TypescriptExtractor) : void {
    marked.use({
        renderer: {
            code: (code, lang) : string => {
                return `<pre><code class="hljs">${highlight.highlight(code, {language: lang || "js"}).value}</code></pre>`;
            }
        },
        extensions: [
            {
                name: "ref",
                level: "inline",
                start: (src) => src.indexOf("[["),
                tokenizer: (src) => {
                    const match = src.match(/(?<=\[\[).+?(?=\]])/);
                    if (match && match.index) {
                        const textBefore = src.slice(0, match.index - 2);
                        return {
                            type: "ref",
                            raw: src.slice(0, match.index + match[0].length + 2),
                            text: match[0].trim(),
                            before: textBefore
                        };
                    }
                    return undefined;
                },
                renderer: (token) => {
                    const otherData: Record<string, unknown> = {};
                    let name = token.text;
                    if (name.includes(".")) {
                        const [thingName, member] = name.split(".");
                        name = thingName;
                        otherData.hash = member;
                    }
                    const ref = firstExtractor.resolveSymbol(name);
                    return `${token.before} ${generator.generateType(ref, otherData) || token.text}`;
                } 
            },
            {
                name: "ref-link",
                level: "inline",
                start: (src) => src.match(/(?:\[(.+?)\])?\{@(link|linkcode|linkplain)\s+((?:.|\n)+?)\}/)?.index,
                tokenizer: (src) => {
                    const match = src.match(/(?:\[(.+?)\])?\{@(link|linkcode|linkplain)\s+((?:.|\n)+?)\}/);
                    if (match && match.index) {
                        const textBefore = src.slice(0, match.index);
                        return {
                            type: "ref-link",
                            raw: src.slice(0, match.index + match[0].length),
                            text: match[3].trim(),
                            before: textBefore
                        };
                    }
                    return undefined;
                },
                renderer: (token) => {
                    const ref = firstExtractor.resolveSymbol(token.text);
                    return `${token.before} ${generator.generateType(ref) || token.text}`;
                }
            }
        ]
    });
}