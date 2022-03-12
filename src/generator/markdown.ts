/* eslint-disable no-case-declarations */

import { TypeKinds, DeclarationTypes, Module, ExtractorUtils, JSDocData, Declaration } from "@ts-docs/extractor";
import highlight from "highlight.js";
import { use } from "marked";
import sanitizer from "sanitize-html";
import { Generator } from ".";
import { OtherRefData } from "..";
import { emitWarning } from "../utils";

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
        headings?: Array<Heading>,
        fnName?: string
    }

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
export function initMarkdown(generator: Generator) : void {
    const allowedTags = [...sanitizer.defaults.allowedTags, "img", "details", "summary"];
    const inheritDocStack: Array<Array<JSDocData>> = [];
    use({
        sanitizer: (html) => sanitizer(html, {allowedTags}),
        renderer: {
            code: function(code, lang) {
                if (!lang) return `<pre><code class="hljs">${code}</code></pre>`;
                return `<pre><code class="hljs">${highlightAndLink(generator, code, lang, (this as marked.Renderer).options.fnName)}</code></pre>`;
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
                    return;
                },
                renderer: (token) => stringToRef(token.text, generator)
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
                    return;
                },
                renderer: (token) => {
                    if (!generator.currentItem) return "";
                    return stringToRef(token.text, generator);
                }
            },
            {
                name: "inherit-doc",
                level: "inline",
                start: (src) => src.indexOf("{@inheritDoc"),
                tokenizer: (src) => {
                    const match = src.match(/^(?:\[(.+?)\])?\{@inheritDoc\s+((?:.|\n)+?)\}/);
                    if (match && match.index !== undefined) {
                        return {
                            type: "inherit-doc",
                            raw: match[0],
                            text: match[2].trim()
                        };
                    }
                    return;
                },
                renderer: (token) => {
                    if (!generator.currentItem) return "";
                    const jsDocData = stringToJsDoc(token.text, generator);
                    if (!jsDocData) return "";
                    const [name, jsDoc] = jsDocData;
                    if (!jsDoc) return "";
                    if (inheritDocStack.includes(jsDoc)) {
                        emitWarning`The "${"@inheritDoc"}" tag for "${name}" refers to it's own documentation.`;
                        return "";
                    }
                    inheritDocStack.push(jsDoc);
                    const edited = [];
                    for (const doc of jsDoc) {
                        edited.push({comment: doc.comment, tags: doc.tags?.filter(tag => tag.name === "remarks" || tag.name === "params" || tag.name === "returns")});
                    }
                    const comment = generator.generateComment(edited, true)?.[0] || "";
                    inheritDocStack.pop();
                    return comment;
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
                tokenizer: function (src) {
                    const full = src.match(/^(?:```[a-z]* --.+\n[\s\S]*?\n```\n?)+/);
                    if (!full || !full[0]) return; 
                    const matches: Array<CodeTab> = [];
                    const separateMatches = [...full[0].matchAll(/```(?<lang>[a-z]*) --(?<tabName>.+)\n(?<content>[\s\S]*?)\n```/g)];
                    if (!separateMatches.length) return;
                    for (const match of separateMatches) {
                        if (!match.groups) continue;
                        const data = match.groups as unknown as CodeTab;
                        matches.push({
                            ...data,
                            content: `<pre><code class="hljs">${highlightAndLink(generator, data.content, data.lang, this.lexer.options.renderer?.options.fnName)}</code></pre>`
                        });
                    }
                    return {
                        type: "tabcode",
                        raw: full[0],
                        tabs: matches,
                        tokens: []
                    };
                },
                renderer: function(token) {
                    return generator.structure.components.codeTabs(token.tabs);
                }
            }
        ]
    });
}

export function highlightAndLink(gen: Generator, text: string, lang?: string, fnName?: string) : string {
    if (!lang) return highlight.highlightAuto(text).value;
    if (lang === "notest" || lang === "ts" || lang === "typescript" || lang === "js" || lang === "javascript") {
        if (gen.tests && !gen.renderingPages) {
            if (lang === "notest") lang = "ts";
            else text = gen.tests.addTest(gen, text, fnName);
        }
        let highlighted = highlight.highlight(text, { language: lang }).value;
        const matched = highlighted.matchAll(/<span class="hljs-title class_">(.*?)<\/span>/g);
        for (const [matchingEl, typeName] of matched) {
            highlighted = highlighted.replace(matchingEl, genReference(typeName, {}, gen));
        }
        return highlighted;
    }
    try {
        return highlight.highlight(text, { language: lang }).value;
    } catch {
        return "";
    }
}

function genReference(str: string, otherData: OtherRefData, generator: Generator) : string {
    let type;
    for (const mod of generator.projects) {
        type = ExtractorUtils.findByNameWithModule(str, mod.module);
        if (type) break;
    }
    if (!type) return str;
    return generator.generateRef({kind: TypeKinds.REFERENCE, type }, otherData);
}

export function parseRefString(name: string, generator: Generator) : {
    name: string,
    otherData: OtherRefData,
    module?: Module,
    refType?: string
} {
    const otherData: OtherRefData = {};
    let module;
    let refType: string|undefined;
    // Detect aliases first
    if (name.includes(" as ")) {
        const [newName, alias] = name.split(" as ");
        otherData.displayName = alias;
        name = newName;
    } else if (name.includes(" | ")) {
        const [newName, alias] = name.split(" | ");
        otherData.displayName = alias;
        name = newName;
    }
    // Then property / method
    if (name.includes(".")) {
        const [thingName, hash] = name.split(".");
        otherData.hash = hash;
        name = thingName;
    } else if (name.includes("#")) {
        const [thingName, hash] = name.split("#");
        otherData.hash = hash;
        name = thingName;
    }
    // Lastly, type enforcement
    if (name.includes(":")) {
        const [realName, type] = name.split(":");
        refType = type;
        name = realName;
    }
    // If the name is a path, resolve it
    if (name.includes("/")) {
        const parts = name.split("/");
        const firstEl = parts.shift();
        let mod = generator.projects.find(ex => ex.module.name === firstEl)?.module || generator.currentModule;
        if (!mod) return {name, otherData, refType};
        const lastElement = parts.pop();
        if (!lastElement) return { name, otherData, refType };
        name = lastElement;
        for (const part of parts) {
            const tempmod = mod.modules.get(part);
            if (!tempmod) return {name: lastElement, otherData, refType};
            mod = tempmod;
        }
        if (mod) module = mod;
    }
    return { name, otherData, module, refType };
}

function findMemberInsideDecl(name: string, decl: Declaration) {
    switch (decl.kind) {
    case DeclarationTypes.CLASS:
        if (name === "constructor") {
            if (decl._constructor) return decl._constructor;
            return;
        }
        const methodDecl = decl.methods.find(m => m.rawName === name);
        if (methodDecl) return methodDecl;
        const propertyDecl = decl.properties.find(p => p.prop && p.prop.rawName === name);
        if (propertyDecl) return propertyDecl;
        break;
    case DeclarationTypes.INTERFACE:
        const propDecl = decl.properties.find(p => p.prop && p.prop.rawName === name);
        if (propDecl) return propDecl;
        break;
    case DeclarationTypes.ENUM:
        const memberDecl = decl.members.find(m => m.name === name);
        if (memberDecl) return memberDecl;
        break;
    default:
        return;
    }
    return;
}

export function stringToRef(refName: string, generator: Generator) : string {
    const { name, otherData, module, refType } = parseRefString(refName, generator);
    if (!module) {
        const decl = generator.currentItem;
        if (decl) {
            const member = findMemberInsideDecl(name, decl);
            if (member) return generator.structure.components.typeReference({local: {name, isMethod: Boolean("signatures" in member)}, other: otherData});
        }
        if (refType) {
            for (const mod of generator.projects) {
                const ref = mod.forEachModule((module) => ExtractorUtils.findOfKindInModule(name, module, refType as string));
                if (ref) return generator.generateRef({kind: TypeKinds.REFERENCE, type: ref }, otherData);
            }
        } else {
            for (const mod of generator.projects) {
                const ref = ExtractorUtils.findByNameWithModule(name, mod.module);
                if (ref) return generator.generateRef({kind: TypeKinds.REFERENCE, type: ref }, otherData);
            }
        }
    } else {
        const foundRef = refType ? ExtractorUtils.findOfKindInModule(name, module, refType) : ExtractorUtils.findByNameWithModule(name, module);
        if (foundRef) return generator.generateRef({kind: TypeKinds.REFERENCE, type: foundRef}, otherData);
    }
    emitWarning`Couldn't find type "${name}"`;
    return name;
}

export function stringToJsDoc(refName: string, generator: Generator) : [string, Array<JSDocData>|undefined]|undefined {
    const { name, otherData, module, refType } = parseRefString(refName, generator);
    let foundDecl;
    if (!module) {
        const decl = generator.currentItem;
        if (decl) {
            const member = findMemberInsideDecl(name, decl);
            if (member) return [`${decl.name}.${name}`, member.jsDoc];
        }
        if (refType) {
            for (const mod of generator.projects) {
                const ref = mod.forEachModule((module) => ExtractorUtils.findDeclOfType(name, module, refType as string));
                if (ref) {
                    foundDecl = ref;
                    break;
                }
            }
        } else {
            for (const mod of generator.projects) {
                const ref = ExtractorUtils.findDeclWithModule(name, mod.module);
                if (ref) {
                    foundDecl = ref;
                    break;
                }
            }
        }
    } else foundDecl = refType ? ExtractorUtils.findDeclOfType(name, module, refType) : ExtractorUtils.findDeclWithModule(name, module);
    if (!foundDecl) {
        emitWarning`Couldn't find type "${name}"`;
        return;
    }
    if (otherData.hash) {
        const member = findMemberInsideDecl(otherData.hash, foundDecl);
        return [`${foundDecl.name}.${otherData.hash}`, member?.jsDoc];
    }
    return [foundDecl.name, foundDecl.jsDoc];
}