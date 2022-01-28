
import { TypeKinds, TypescriptExtractor } from "@ts-docs/extractor";
import highlight from "highlight.js";
import marked from "marked";
import sanitizer from "sanitize-html";
import { Generator } from ".";

export interface Heading {
    name: string,
    id: string,
    subHeadings: Array<Heading>
}

export interface CodeTab {
    lang: string,
    tabName: string,
    content: string
}

declare module "marked" {

    export interface MarkedExtension {
        extensions?: Array<{
            name: string,
            level: string,
            start: (src: string) => number|boolean|undefined,
            tokenizer: (this: {lexer: marked.Lexer}, src: string, tokens: Array<marked.Token>) => {type: string, raw: string, text?: string, tokens?: Array<marked.Token>, tabs?: Array<CodeTab>}|undefined,
            renderer: (this: {parser: marked.Parser}, token: {type: string, raw: string, text: string, tokens?: Array<marked.Token>, tabs?: Array<CodeTab>}) => string
        }>
    }

    export interface MarkedOptions {
        headings: Array<Heading>
    }

}

function genReference(str: string, otherData: Record<string, unknown>, generator: Generator, extractor: TypescriptExtractor) : string {
    let type;
    for (const mod of generator.projects) {
        type = extractor.refs.findByNameWithModule(str, mod);
        if (type) break;
    }
    if (!type) return str;
    return generator.generateRef({kind: TypeKinds.REFERENCE, type }, otherData);
}

/**
 * Adds the following custom marked extensions:
 * 
 * - References like [[initMarkdown as this]] (`[[initMarkdown as this]]`)
 * - JSDoc `@link` tags
 * - Warning blocks (`|> This`)
 * - Adds the custom "section-header" class to all headings
 * - Wraps are codeblocks in the `hljs` class
 * - Resolves relative asset links
 * - Code tabs
 */
export function initMarkdown(generator: Generator, extractor: TypescriptExtractor) : void {
    const allowedTags = [...sanitizer.defaults.allowedTags, "img", "details", "summary"];
    marked.use({
        sanitizer: (html) => sanitizer(html, {allowedTags}),
        renderer: {
            code: (code, lang) : string => {
                if (!lang) return `<pre><code class="hljs">${code}</code></pre>`;
                return `<pre><code class="hljs">${highlightAndLink(generator, extractor, code, lang)}</code></pre>`;
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
                else if (link.startsWith("/assets")) link = `${"../".repeat(generator.depth)}${link.slice(1)}`;
                return `<img src="${link}" title="${title}" alt="${text}" class="img-fluid">`;
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
                        let mod = generator.projects.find(ex => ex.module.name === firstEl)?.module || generator.projects[0].module;
                        if (!mod) return name;
                        const lastElement = parts.pop();
                        for (const part of parts) {
                            const tempmod = mod.modules.get(part);
                            if (!tempmod) return name;
                            mod = tempmod;
                        }
                        if (mod && lastElement) {
                            let thingName: string = lastElement;
                            if (lastElement.includes(".")) {
                                const [newThingName, hash] = name.split(".");
                                thingName = newThingName;
                                otherData.hash = hash;
                            }
                            return genReference(thingName, otherData, generator, extractor);
                        }
                    }
                    if (name.includes(".")) {
                        const [thingName, hash] = name.split(".");
                        otherData.hash = hash;
                        return genReference(thingName, otherData, generator, extractor);
                    } else if (name.includes("#")) {
                        const [thingName, hash] = name.split("#");
                        otherData.hash = hash;
                        return genReference(thingName, otherData, generator, extractor);
                    }
                    return genReference(name, otherData, generator, extractor);
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
                    return genReference(token.text, {}, generator, extractor);
                }
            },
            {
                name: "warning",
                level: "block",
                start: (src) => src.indexOf("|>"),
                tokenizer: function(src)  {
                    const match = src.match(/^\|>(.*)/);
                    if (match && match.index !== undefined) {
                        let text = match[1];
                        let style = "warning";
                        if (text.startsWith("[")) {
                            const indOfEnd = text.indexOf("]");
                            if (indOfEnd !== -1) {
                                style = text.slice(1, indOfEnd);
                                text = text.slice(indOfEnd + 1);
                            }
                        }
                        const tokens: Array<marked.Token> = [];
                        //@ts-expect-error Marked has outdated typings.
                        this.lexer.inline(text, tokens);
                        return {
                            type: "warning",
                            raw: match[0],
                            text,
                            style,
                            tokens
                        };
                    }
                    return;
                },
                renderer: function(token) {
                    //@ts-expect-error Marked has outdated typings.
                    return `<p class="text-block text-block-${token.style}">${this.parser.parseInline(token.tokens)}</p>`;
                }
            },
            {
                name: "tabcode",
                level: "block",
                start: (src) => src.indexOf("```"),
                tokenizer: function (src, tokens) {
                    const full = src.match(/(?:```[a-z]* --.+\n[\s\S]*?\n```\n?)+/);
                    if (!full || !full[0]) return; 
                    const matches: Array<CodeTab> = [];
                    const separateMatches = [...full[0].matchAll(/```(?<lang>[a-z]*) --(?<tabName>.+)\n(?<content>[\s\S]*?)\n```/g)];
                    if (!separateMatches.length) return;
                    for (const match of separateMatches) {
                        if (!match.groups) continue;
                        const data = match.groups as unknown as CodeTab;
                        matches.push({
                            ...data,
                            content: `<pre><code class="hljs">${highlightAndLink(generator, extractor, data.content, data.lang)}</code></pre>`
                        });
                    }
                    return {
                        type: "tabcode",
                        raw: full[0],
                        tabs: matches,
                        tokens: []
                    }
                },
                renderer: function(token) {
                    return generator.structure.components.codeTabs(token.tabs);
                }
            }
        ]
    });
}

export function highlightAndLink(gen: Generator, extractor: TypescriptExtractor, text: string, lang?: string) : string {
    let highlighted;
    try {
        highlighted = lang ? highlight.highlight(text, {language: lang}).value : highlight.highlightAuto(text).value;
    } catch {
        return text;
    }
    if (lang === "ts" || lang === "typescript" || lang === "js" || lang === "javascript") {
        const matched = highlighted.matchAll(/<span class=\"hljs-title class_\">(.*?)<\/span>/g);
        for (const [matchingEl, typeName] of matched) {
            highlighted = highlighted.replace(matchingEl, genReference(typeName, {}, gen, extractor));
        }
        return highlighted;
    }
    return highlighted;
}