
import { ExtractorList } from "@ts-docs/extractor";
import { TypeKinds } from "@ts-docs/extractor/dist/structure";
import highlight from "highlight.js";
import marked from "marked";
import { Generator } from "./generator";

// Array of h1, { subHeadings: [] }
// Array of h2
export interface Heading {
    name: string,
    id: string,
    subHeadings: Array<Heading>
}

declare module "marked" {

    export interface MarkedExtension {
        extensions?: Array<{
            name: string,
            level: string,
            start: (src: string) => number|boolean|undefined,
            tokenizer: (this: {lexer: marked.Lexer}, src: string, tokens: Array<marked.Token>) => {type: string, raw: string, text: string, tokens?: Array<marked.Token>}|undefined,
            renderer: (this: {parser: marked.Parser}, token: {type: string, raw: string, text: string, tokens?: Array<marked.Token>}) => string
        }>
    }

    export interface MarkedOptions {
        headings: Array<Heading>
    }

}

function genReference(str: string, otherData: Record<string, unknown>, generator: Generator, extractors: ExtractorList) : string {
    const type = extractors[0].references.resolveExternalString(str, extractors);
    if (!type) return str;
    return generator.generateRef({kind: TypeKinds.REFERENCE, type}, otherData);
}

/**
 * Adds the following custom marked extensions:
 * 
 * - References like [[initMarkdown as this]]
 * - Warning blocks (`|> This`)
 * - Adds the custom "section-header" class to all headings
 * - Wraps are codeblocks in the `hljs` class
 * - Resolves relative image links
 */
export function initMarkdown(generator: Generator, extractors: ExtractorList) : void {
    marked.use({
        renderer: {
            code: (code, lang) : string => {
                return `<pre><code class="hljs">${highlight.highlight(code, {language: lang || "js"}).value}</code></pre>`;
            },
            heading: function(text, level, raw, slug) {
                const headings = (this as marked.Renderer).options.headings;
                const id = slug.slug(text);
                if (headings) {
                    if (level === 1) headings.push({name: text, subHeadings: [], id});
                    else if (headings.length) {
                        let lastLevel = headings[headings.length - 1];
                        for (let lvl=1; lvl < level - 1; lvl++) {
                            const newLastLevel = lastLevel.subHeadings[lastLevel.subHeadings.length - 1];
                            if (!newLastLevel) break;
                            lastLevel = newLastLevel;
                        }
                        lastLevel.subHeadings.push({name: text, subHeadings: [], id});
                    }
                }
                return `<h${level} id="${id}" class="section-header">${text}</h${level}>`;
            },
            image: (link, title, text) : string => {
                if (!link) return "";
                if (link.startsWith("./assets")) link = `${"../".repeat(generator.depth)}${link.slice(2)}`;
                else if (link.startsWith("assets")) link = `${"../".repeat(generator.depth)}${link}`;
                return `<img src="${link}" title="${title}" alt="${text}">`;
            }
        },
        extensions: [
            {
                name: "ref",
                level: "inline",
                start: (src) => src.indexOf("[["),
                tokenizer: (src) => {
                    const match = src.match(/^\[\[([^\]]+)\]\]/);
                    if (match && match.index !== undefined) {
                        return {
                            type: "ref",
                            raw: match[0],
                            text: match[1].trim(),
                        };
                    }
                    return undefined;
                },
                renderer: (token) => {
                    const otherData: Record<string, unknown> = {};
                    let name = token.text;
                    if (name.includes(" as ")) {
                        const [newName, alias] = name.split(" as ");
                        otherData.displayName = alias;
                        name = newName;
                    }
                    if (name.includes("/")) {
                        const parts = name.split("/");
                        const firstEl = parts.shift();
                        let mod = extractors.find(ex => ex.module.name === firstEl)?.module;
                        if (!mod) return "";
                        const lastElement = parts.pop();
                        for (const part of parts) {
                            mod = mod.modules.get(part);
                            if (!mod) return name;
                        }
                        if (mod && lastElement) {
                            let thingName: string = lastElement;
                            if (lastElement.includes(".")) {
                                const [newThingName, hash] = name.split(".");
                                thingName = newThingName;
                                otherData.hash = hash;
                            }
                            return genReference(thingName, otherData, generator, extractors);
                        }
                    }
                    if (name.includes(".")) {
                        const [thingName, hash] = name.split(".");
                        otherData.hash = hash;
                        return genReference(thingName, otherData, generator, extractors);
                    } else if (name.includes("#")) {
                        const [thingName, hash] = name.split("#");
                        otherData.hash = hash;
                        return genReference(thingName, otherData, generator, extractors);
                    }
                    return genReference(name, otherData, generator, extractors);
                } 
            },
            {
                name: "ref-link",
                level: "inline",
                start: (src) => src.match(/^(?:\[(.+?)\])?\{@(link|linkcode|linkplain)\s+((?:.|\n)+?)\}/)?.index,
                tokenizer: (src) => {
                    const match = src.match(/^(?:\[(.+?)\])?\{@(link|linkcode|linkplain)\s+((?:.|\n)+?)\}/);
                    if (match && match.index !== undefined) {
                        return {
                            type: "ref-link",
                            raw: match[0],
                            text: match[3].trim(),
                        };
                    }
                    return undefined;
                },
                renderer: (token) => {
                    return genReference(token.text, {}, generator, extractors);
                }
            },
            {
                name: "warning",
                level: "block",
                start: (src) => src.indexOf("|>"),
                tokenizer: function(src)  {
                    const match = src.match(/^\|>(.*)/);
                    if (match && match.index !== undefined) {
                        const tokens: Array<marked.Token> = [];
                        //@ts-expect-error Marked has outdated typings.
                        this.lexer.inline(match[1], tokens);
                        return {
                            type: "warning",
                            raw: match[0],
                            text: match[1],
                            tokens
                        };
                    }
                    return;
                },
                renderer: function(token) {
                    //@ts-expect-error Marked has outdated typings.
                    return `<p class="text-warning">${this.parser.parseInline(token.tokens)}</p>`;
                }
            }
        ]
    });
}