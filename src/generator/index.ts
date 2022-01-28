/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DocumentStructure, setupDocumentStructure } from "../documentStructure";
import { parse as markedParse } from "marked";
import { copyFolder, createFile, createFolder, escapeHTML, fetchChangelog } from "../utils";
import { Project, TypescriptExtractor, ClassDecl, Reference, Type, TypeKinds, ArrowFunction, TypeParameter, FunctionParameter, ClassMethod, JSDocData, Module, TypeReferenceKinds, IndexSignatureDeclaration, InterfaceDecl, EnumDecl, Literal, TypeDecl, FunctionDecl, ConstantDecl, FunctionSignature, ObjectProperty, ConstructorType, InferType, TypeOperator } from "@ts-docs/extractor";
import path from "path";
import { LandingPage, PageCategory, TsDocsOptions } from "../options";
import fs from "fs";
import { Heading, highlightAndLink, initMarkdown } from "./markdown";
import { packSearchData } from "./searchData";
import { FileExports } from "@ts-docs/extractor/dist/extractor/ExportHandler";

export const enum PageTypes {
    INDEX,
    PAGE,
    CHANGELOG,
    MODULE,
    CLASS,
    INTERFACE,
    ENUM,
    TYPE,
    FUNCTION,
    CONST
}

export interface OtherProps {
    [key: string]: unknown,
    depth?: number,
    type?: PageTypes
}

export type ModuleExports = FileExports | Record<string, FileExports> | undefined;

export interface IndexData {
    name?: string,
    type: PageTypes,
    path: [string, string, string],
    content: string,
    class?: ClassDecl,
    interface?: InterfaceDecl,
    enum?: EnumDecl,
    module?: Module,
    projects: Array<Project>,
    pages: Array<PageCategory>,
    headings: Array<Heading>,
    exports: ModuleExports
}

export interface OtherRefData {
    displayName?: string,
    hash?: string,
    filename?: string
}

/**
 * The class responsible for documentation generator. Takes in a documentation structure and settings.
 */
export class Generator {
    structure: DocumentStructure
    settings: TsDocsOptions
    /**
     * How "deep" the current thing is from the root.
     */
    depth = 0
    /**
     * The name of the current **global** [[Module]] being rendered.
     * It's going to be undefined if there is only one entry point.
     */
    currentGlobalModuleName?: string
    /**
     * Only true when the custom pages are being rendered
     */
    renderingPages?: boolean
    activeBranch: string
    landingPage!: LandingPage
    projects!: Array<Project>
    extractor!: TypescriptExtractor
    constructor(settings: TsDocsOptions, activeBranch = "main") {
        this.settings = settings;
        this.activeBranch = activeBranch;
        this.landingPage = settings.landingPage as LandingPage;
        this.structure = setupDocumentStructure(this.settings.structure, this);
    }

    async generate(extractor: TypescriptExtractor, projects: Array<Project>): Promise<void> {
        this.projects = projects;
        this.extractor = extractor;
        initMarkdown(this, extractor);
        const out = this.settings.out;
        createFolder(out);
        const assetsFolder = path.join(out, "./assets");
        createFolder(assetsFolder);
        copyFolder(this.structure.assetsPath, assetsFolder);
        if (this.settings.assets) copyFolder(this.settings.assets, assetsFolder);

        packSearchData(projects, `${assetsFolder}/search.json`);

        if (this.settings.customPages) {
            const pagesPath = path.join(out, "./pages");
            createFolder(pagesPath);
            this.renderingPages = true;
            for (const category of this.settings.customPages) {
                category.pages.sort((a, b) => +(a.attributes.order || Infinity) - +(b.attributes.order || Infinity));
                for (const page of category.pages) {
                    // +2 because pages/category
                    this.depth += 2;
                    const [markdown, headings] = this.generateMarkdownWithHeaders(page.content);
                    this.generatePage(pagesPath, category.name, page.name, markdown, {
                        type: PageTypes.PAGE,
                        pages: this.settings.customPages,
                        headings
                    });
                    this.depth -= 2;
                }
            }
            delete this.renderingPages;
        }
        if (projects.length === 1) {
            const pkg = projects[0];
            if (this.settings.changelog && pkg.repository) await this.generateChangelog(pkg.repository, undefined, pkg.module);
            this.generateThingsInsideModule(this.settings.out, pkg.module);
            const exports = this.generateExports(pkg.module);
            this.generatePage(this.settings.out, "./", "index", this.structure.components.module({
                module: pkg.module,
                readme: pkg.readme && markedParse(pkg.readme),
                exports
            }), {
                type: PageTypes.MODULE,
                module: pkg.module,
                doNotGivePath: true,
                exports
            });
        } else {
            if (this.settings.changelog && this.landingPage.repository) await this.generateChangelog(this.landingPage.repository, projects);
            if (this.landingPage.readme) this.generatePage(this.settings.out, "./", "index", markedParse(this.landingPage.readme), { type: PageTypes.INDEX, projects, doNotGivePath: true });
            for (const pkg of projects) {
                this.currentGlobalModuleName = pkg.module.name;
                this.depth++;
                this.generateModule(this.settings.out, pkg.module, pkg.readme);
                this.depth--;
            }
        }
    }

    async generateChangelog(repo: string, projects?: Array<Project>, module?: Module): Promise<void> {
        const changelog = await fetchChangelog(repo);
        if (!changelog) {
            this.settings.changelog = false;
            return;
        }
        changelog.content = markedParse(changelog.content);
        this.generatePage(this.settings.out, "./", "changelog", this.structure.components.changelog(changelog), {
            type: projects ? PageTypes.INDEX : PageTypes.MODULE,
            module,
            projects
        });
    }

    generateThingsInsideModule(path: string, module: Module): void {
        // +1 because class/interface/enum/function/type/constant
        this.depth++;
        this.sortArr(module.classes, "name");
        for (const classObj of module.classes) {
            this.generateClass(path, classObj);
        }
        this.sortArr(module.interfaces, "name");
        for (const interfaceObj of module.interfaces) {
            this.generateInterface(path, interfaceObj);
        }
        this.sortArr(module.enums, "name");
        for (const enumObj of module.enums) {
            this.generateEnum(path, enumObj);
        }
        this.sortArr(module.types, "name");
        for (const typeObj of module.types) {
            this.generateTypeDecl(path, typeObj, module);
        }
        this.sortArr(module.functions, "name");
        for (const fnObj of module.functions) {
            this.generateFunction(path, fnObj, module);
        }
        this.sortArr(module.constants, "name");
        for (const constantObj of module.constants) {
            this.generateConstant(path, constantObj, module);
        }
        const modArr = [...module.modules.values()];
        this.sortArr(modArr, "name");
        for (const mod of modArr) {
            this.generateModule(path, mod);
        }
        this.depth--;
    }

    generateModule(p: string, module: Module, readme?: string): void {
        const exports = this.generateExports(module);
        const folderName = `${p}/m.${module.name}`;
        createFolder(folderName);
        this.generateThingsInsideModule(folderName, module);
        this.generatePage(p, `m.${module.name}`, "index", this.structure.components.module({
            module,
            readme: readme && markedParse(readme),
            exports,
        }), { type: PageTypes.MODULE, module, name: module.name, exports });
    }

    generateClass(path: string, classObj: ClassDecl): void {
        if (classObj.isCached) return;
        if (this.settings.sort === "alphabetical") {
            classObj.properties.sort((a, b) => {
                if (a.index) return 1;
                if (b.index) return -1;
                return a.prop!.rawName.localeCompare(b.prop!.rawName);
            })
        }
        this.sortArr(classObj.methods, "rawName");
        this.generatePage(path, "class", classObj.id ? `${classObj.name}_${classObj.id}` : classObj.name,
        this.structure.components.class(classObj), { class: classObj, name: classObj.name, type: PageTypes.CLASS });
    }

    generateInterface(path: string, interfaceObj: InterfaceDecl): void {
        if (interfaceObj.isCached) return;
        if (this.settings.sort === "alphabetical") {
            interfaceObj.properties.sort((a, b) => {
                if (!a.prop || !a.prop.rawName) return 1;
                if (!b.prop || !b.prop.rawName) return -1;
                return a.prop.rawName.localeCompare(b.prop.rawName);
            });
        }
        this.generatePage(path, "interface", interfaceObj.id ? `${interfaceObj.name}_${interfaceObj.id}` : interfaceObj.name, this.structure.components.interface(interfaceObj), { interface: interfaceObj, name: interfaceObj.name, type: PageTypes.INTERFACE });
    }

    generateEnum(path: string, enumObj: EnumDecl): void {
        if (enumObj.isCached) return;
        this.sortArr(enumObj.members, "name");
        this.generatePage(path, "enum", enumObj.id ? `${enumObj.name}_${enumObj.id}` : enumObj.name, this.structure.components.enum(enumObj), { type: PageTypes.ENUM, enum: enumObj, name: enumObj.name });
    }

    generateTypeDecl(path: string, typeObj: TypeDecl, module: Module): void {
        if (typeObj.isCached) return;
        this.generatePage(path, "type", typeObj.id ? `${typeObj.name}_${typeObj.id}` : typeObj.name, this.structure.components.type(typeObj), { type: PageTypes.TYPE, module, name: typeObj.name });
    }

    generateFunction(path: string, func: FunctionDecl, module: Module): void {
        if (func.isCached) return;
        this.generatePage(path, "function", func.id ? `${func.name}_${func.id}` : func.name, this.structure.components.function(func), { type: PageTypes.FUNCTION, module, name: func.name });
    }

    generateConstant(path: string, constant: ConstantDecl, module: Module): void {
        if (constant.isCached) return;
        this.generatePage(path, "constant", constant.id ? `${constant.name}_${constant.id}` : constant.name, this.structure.components.constant({
            constant,
            content: constant.content && highlightAndLink(this, this.extractor, constant.content, "ts"),
        }), { type: PageTypes.CONST, module, name: constant.name });
    }

    generateConstructType(ref: FunctionSignature | ConstructorType, includeNew?: boolean): string {
        return this.structure.components.typeConstruct({
            fn: ref,
            includeNew
        });
    }

    generateRef(ref: Reference, other: OtherRefData = {}): string {
        if (ref.type.link) return this.structure.components.typeReference({ref, other});
        let refType = "";
        switch (ref.type.kind) {
            case TypeReferenceKinds.STRINGIFIED_UNKNOWN: return ref.type.name;
            case TypeReferenceKinds.CLASS: refType = "class"; break;
            case TypeReferenceKinds.INTERFACE: refType = "interface"; break;
            case TypeReferenceKinds.ENUM:
            case TypeReferenceKinds.ENUM_MEMBER: refType = "enum";  break;
            case TypeReferenceKinds.TYPE_ALIAS: refType = "type"; break;
            case TypeReferenceKinds.FUNCTION: refType = "function"; break;
            case TypeReferenceKinds.CONSTANT: refType = "constant"; break;
            case TypeReferenceKinds.INTERNAL: return this.structure.components.typeReference({ref, other});
            case TypeReferenceKinds.NAMESPACE_OR_MODULE: {
                if (!ref.type.path) return ref.type.name;
                return this.structure.components.typeReference({
                    ref, other,
                    link: ref.type.path && this.generateLink(path.join(...ref.type.path.map(p => `m.${p}`), ref.type.path[ref.type.path.length - 1] !== ref.type.name ? `m.${ref.type.name}` : "", `index.html${other.hash ? `#${other.hash}`:""}`))
                });
            }
            default: refType = "";
        }
        return this.structure.components.typeReference({
            ref, other,
            link: ref.type.path && this.generateLink(path.join(...ref.type.path.map(p => `m.${p}`), refType, `${ref.type.name}${ref.type.id ? `_${ref.type.id}` : ""}.html`), ref.type.displayName),
            typeParameters: ref.typeArguments?.map(param => this.generateType(param)),
        });
    }

    generateArrowFunction(ref: ArrowFunction): string {
        return this.structure.components.typeFunction(ref);
    }

    generateType(type: Type, other: Record<string, unknown> = {}): string {
        switch (type.kind) {
            case TypeKinds.REFERENCE: return this.generateRef(type as Reference, other);
            case TypeKinds.ARROW_FUNCTION: return this.generateArrowFunction(type as ArrowFunction);
            case TypeKinds.UNION: return this.structure.components.typeUnion(type);
            case TypeKinds.INTERSECTION: return this.structure.components.typeIntersection(type);
            case TypeKinds.TUPLE: return this.structure.components.typeTuple(type);
            case TypeKinds.ARRAY_TYPE: return this.structure.components.typeArray(type);
            case TypeKinds.MAPPED_TYPE: return this.structure.components.typeMapped(type);
            case TypeKinds.CONDITIONAL_TYPE: return this.structure.components.typeConditional(type);
            case TypeKinds.TYPE_PREDICATE: return this.structure.components.typePredicate(type);
            case TypeKinds.INDEX_ACCESS: return this.structure.components.typeIndexAccess(type);
            case TypeKinds.TEMPLATE_LITERAL: return this.structure.components.typeTemplateLiteral(type);
            case TypeKinds.INFER_TYPE: return this.structure.components.typeOperator({ name: "infer", type: (type as InferType).typeParameter });
            case TypeKinds.UNIQUE_OPERATOR: return this.structure.components.typeOperator({ name: "unique", type: (type as TypeOperator).type });
            case TypeKinds.KEYOF_OPERATOR: return this.structure.components.typeOperator({ name: "keyof", type: (type as TypeOperator).type });
            case TypeKinds.READONLY_OPERATOR: return this.structure.components.typeOperator({ name: "readonly", type: (type as TypeOperator).type });
            case TypeKinds.TYPEOF_OPERATOR: return this.structure.components.typeOperator({ name: "typeof", type: (type as TypeOperator).type });
            case TypeKinds.STRING:
            case TypeKinds.NUMBER:
            case TypeKinds.VOID:
            case TypeKinds.TRUE:
            case TypeKinds.FALSE:
            case TypeKinds.BOOLEAN:
            case TypeKinds.UNDEFINED:
            case TypeKinds.NULL:
            case TypeKinds.UNKNOWN:
            case TypeKinds.STRING_LITERAL:
            case TypeKinds.NUMBER_LITERAL:
            case TypeKinds.SYMBOL:
            case TypeKinds.NEVER:
            case TypeKinds.BIGINT:
            case TypeKinds.OBJECT:
            case TypeKinds.THIS:
            case TypeKinds.REGEX_LITERAL:
            case TypeKinds.ANY: return this.structure.components.typePrimitive(type);
            case TypeKinds.OBJECT_LITERAL: return this.structure.components.typeObject(type);
            case TypeKinds.CONSTRUCTOR_TYPE: return this.generateConstructType((type as ConstructorType), true);
            case TypeKinds.STRINGIFIED_UNKNOWN: return escapeHTML((type as Literal).name);
            default: return "unknown";
        }
    }

    generateTypeParameter(type: TypeParameter): string {
        return this.structure.components.typeParameter(type);
    }

    generateParameter(type: FunctionParameter): string {
        return this.structure.components.functionParameter(type);
    }

    generateComment(comments?: Array<JSDocData>, includeTags = false, exclude?: Record<string, boolean>): [block: string, inline: string] | undefined {
        if (!comments) return undefined;
        let text = markedParse(comments.map(c => c.comment || "").join("\n"));
        let inline = "";
        if (includeTags) {
            for (const comment of comments) {
                if (!comment.tags) continue;
                for (const tag of comment.tags) {
                    if (exclude && exclude[tag.name]) continue;
                    const res = this.structure.components.jsdocTags({
                        tagName: tag.name,
                        comment: tag.comment && markedParse(tag.comment),
                        arg: tag.arg,
                        type: tag.type
                    }) as { block?: string, inline?: string };
                    if (res.block) text += res.block;
                    if (res.inline) inline += res.inline;
                }
            }
        }
        return [text, inline];
    }

    generateMarkdownWithHeaders(content: string): [string, Array<Heading>] {
        const headings: Array<Heading> = [];
        const markdown = markedParse(content, { headings });
        return [markdown, headings];
    }

    generateMarkdown(content: string) : string {
        return markedParse(content);
    }

    generateExports(module: Module): ModuleExports {
        if (this.settings.exportMode === "simple") {
            const index = module.exports.index;
            if (!index) return { exports: [], reExports: [] };
            const newExp = { exports: index.exports.slice(), reExports: [] } as FileExports;
            for (const reExport of index.reExports) {
                if (reExport.sameModule && !reExport.namespace) {
                    const modExp = module.exports[reExport.filename!];
                    if (!modExp) continue;
                    newExp.exports.push(...modExp.exports);
                    newExp.reExports.push(...modExp.reExports);
                } else {
                    if (!reExport.namespace && newExp.reExports.some(r => r.module === reExport.module)) continue;
                    let references;
                    if (reExport.sameModule && !reExport.references.length) references = module.exports[reExport.filename!].exports;
                    else references = reExport.references;
                    newExp.reExports.push({ ...reExport, references });
                }
            }
            return newExp;
        } else {
            return module.exports;
        }
    }

    generatePage(p: string, directory: string, file: string, content: string, other: Partial<IndexData & OtherProps> = {}): string {
        return createFile(p, directory, `${file}.html`, this.structure.components.index({
            content,
            path: !other.doNotGivePath && [p.slice(this.settings.out.length), directory, file],
            depth: this.depth,
            currentGlobalModuleName: this.currentGlobalModuleName,
            ...other
        }));
    }

    generateFolder(p: string) : void {
        if (!fs.existsSync(p)) fs.mkdirSync(p);
    }

    generateLink(p: string, hash?: string): string {
        return `${path.join("../".repeat(this.depth), p)}${hash ? `#.${hash}` : ""}`;
    }

    sortArr(arr: Array<any>, name: "rawName" | "name") : void {
        if (this.settings.sort === "alphabetical") arr.sort((a, b) => (a[name] as string).localeCompare(b[name]!));
    }

}

export * from "./markdown";
export * from "./searchData";
export * from "./fileCache";