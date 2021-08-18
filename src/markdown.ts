
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
            tokenizer: (src: string) => {type: string, raw: string, text: string}|undefined,
            renderer: (token: {type: string, raw: string, text: string}) => string
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
                    console.log(src.indexOf("[["));
                    const match = src.match(/(?<=\[\[).+?(?=\]])/);
                    if (match && match.index) return {
                        type: "ref",
                        raw: `[[${match[0]}]]`,
                        text: match[0].trim()
                    };
                    return undefined;
                },
                renderer: (token) => {
                    const ref = firstExtractor.resolveSymbol(token.text);
                    return generator.generateType(ref) || token.text;
                } 
            }
        ]
    });
}