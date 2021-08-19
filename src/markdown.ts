
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
            tokenizer: (this: {lexer: marked.Lexer}, src: string, tokens: Array<marked.Token>) => {type: string, raw: string, text: string, before?: string, tokens?: Array<marked.Token>}|undefined,
            renderer: (this: {parser: marked.Parser}, token: {type: string, raw: string, text: string, before?: string, tokens?: Array<marked.Token>}) => string
        }>
    }
}

export function initMarkdown(generator: Generator, firstExtractor: TypescriptExtractor) : void {
    marked.use({
        renderer: {
            code: (code, lang) : string => {
                return `<pre><code class="hljs">${highlight.highlight(code, {language: lang || "js"}).value}</code></pre>`;
            },
            heading: (text, level) : string => {
                return `<h${level} id="${text}" class="section-header">${text}</h${level}>`;
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
            },
            {
                name: "warning",
                level: "block",
                start: (src) => src.indexOf("|>"),
                tokenizer: function(src)  {
                    const match = src.match(/\|>(.*)/);
                    if (match) {
                        const tokens: Array<marked.Token> = [];
                        //@ts-expect-error Marked has outdated typings.
                        this.lexer.inline(match[1], tokens);
                        return {
                            type: "warning",
                            raw: src,
                            text: match[1],
                            tokens
                        };
                    }
                    return undefined;
                },
                renderer: function(token) {
                    //@ts-expect-error Marked has outdated typings.
                    return `<p class="text-warning">${this.parser.parseInline(token.tokens)}</p>`;
                }
            }
        ]
    });
}