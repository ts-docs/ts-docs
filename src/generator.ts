/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DocumentStructure } from "./documentStructure";
import marked from "marked";
import { copyFolder, createFile, escapeHTML, fetchChangelog, getPathFileName, getTagFromJSDoc, hasTagFromJSDoc, isLargeArr, isLargeObject, isLargeSignature } from "./utils";
import { Project, TypescriptExtractor, ClassDecl, ClassProperty, Reference, Type, TypeKinds, ArrowFunction, TypeParameter, FunctionParameter, ClassMethod, JSDocData, Module, TypeReferenceKinds, UnionOrIntersection, Tuple, ObjectLiteral, IndexSignatureDeclaration, InterfaceDecl, EnumDecl, Literal, ArrayType, TypeDecl, FunctionDecl, ConstantDecl, ConditionalType, MappedType, TypeOperator, IndexAccessedType, FunctionSignature, TypePredicateType, InferType, ObjectProperty, ConstructorType } from "@ts-docs/extractor";
import path from "path";
import { LandingPage, TsDocsOptions } from "./options";
import fs from "fs";
import Highlight from "highlight.js";
import { Heading, initMarkdown } from "./markdown";
import { packSearchData } from "./searchData";

export interface OtherProps {
    [key: string]: unknown,
    depth?: number,
    type?: string
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
    depth: number
    /**
     * The name of the current **global** [[Module]] being rendered.
     * It's going to be undefined if there is only one entry point.
     */
    currentGlobalModuleName?: string
    /**
     * Only true when the custom pages are being rendered
     */
    renderingPages?: boolean
    activeBranch = "main"
    landingPage!: LandingPage
    constructor(structure: DocumentStructure, settings: TsDocsOptions) {
        this.structure = structure;
        this.settings = settings;
        this.depth = 0;
        this.landingPage = settings.landingPage as LandingPage;
    }

    async generate(extractor: TypescriptExtractor, projects: Array<Project>) : Promise<void> {
        initMarkdown(this, extractor, projects);
        if (!fs.existsSync(this.settings.out)) fs.mkdirSync(this.settings.out);
        const assetsFolder = path.join(this.settings.out, "assets");
        if (!fs.existsSync(assetsFolder)) fs.mkdirSync(assetsFolder);

        if (this.settings.assets) copyFolder(this.settings.assets, assetsFolder);
        copyFolder(path.join(this.structure.path, "assets"), assetsFolder);

        packSearchData(projects, `${assetsFolder}/search.json`);

        if (this.settings.customPages) {
            fs.mkdirSync(path.join(this.settings.out, "./pages"));
            this.renderingPages = true;
            for (const category of this.settings.customPages) {
                category.pages.sort((a, b) => +(a.attributes.order || Infinity) - +(b.attributes.order || Infinity));
                for (const page of category.pages) {
                    // +2 because pages/category
                    this.depth+=2;
                    const [markdown, headings] = this.generateMarkdownWithHeaders(page.content);
                    this.generatePage("pages", category.name, page.name, markdown, {
                        type: "page",
                        pages: this.settings.customPages,
                        unclickablePath: 0,
                        headings
                    });
                    this.depth-=2;
                }
            }
            delete this.renderingPages;
        }
        if (projects.length === 1) {
            const pkg = projects[0];
            if (this.settings.changelog && pkg.repository) await this.generateChangelog(pkg.repository, undefined, pkg.module);
            this.generateModule("", pkg.module, false);
            this.generatePage("", "./", "index", this.structure.components.module({
                ...pkg.module,
                readme: pkg.readme && marked.parse(pkg.readme),
                exports: pkg.module.exports.map(ex => ({alias: ex.alias, ref: this.generateRef({kind: TypeKinds.REFERENCE, type: ex})})),
                reExports: pkg.module.reExports.map(ex => ({module: this.generateRef({kind: TypeKinds.REFERENCE, type: ex.module}), references: ex.references.map(r => ({ref: this.generateRef({kind: TypeKinds.REFERENCE, type: r}), alias: r.alias})), alias: ex.alias, reExportsReExport: ex.reExportsReExport})),
            }), { 
                type: "module", 
                module: pkg.module, 
                pages: this.settings.customPages, 
                branches: this.settings.branches,
                doNotGivePath: true });
        } else {
            if (this.settings.changelog && this.landingPage.repository) await this.generateChangelog(this.landingPage.repository, projects);
            if (this.landingPage.readme) this.generatePage("", "./", "index", marked.parse(this.landingPage.readme), { type: "index", projects, pages: this.settings.customPages, branches: this.settings.branches, doNotGivePath: true });
            for (const pkg of projects) {
                this.currentGlobalModuleName = pkg.module.name;
                this.depth++;
                this.generateModule("", pkg.module, true, pkg.readme);
                this.depth--;
            }
        }
    }

    async generateChangelog(repo: string, projects?: Array<Project>, module?: Module) : Promise<void> {
        const changelog = await fetchChangelog(repo);
        if (!changelog) {
            this.settings.changelog = false;
            return;
        }
        changelog.content = marked.parse(changelog.content);
        this.generatePage("", "./", "changelog", this.structure.components.changelog(changelog), { 
            type: projects ? "index":"module", 
            module, 
            pages: this.settings.customPages, 
            branches: this.settings.branches, 
            activeBranch: this.activeBranch,
            projects
        });
    }

    generateModule(path: string, module: Module, createFolder = true, readme?: string) : void {
        if (createFolder) {
            if (!module.name) return;
            this.generatePage(path, `m.${module.name}`, "index", this.structure.components.module({
                ...module, 
                readme: readme && marked.parse(readme), 
                exports: module.exports.map(ex => ({alias: ex.alias, ref: this.generateRef({kind: TypeKinds.REFERENCE, type: ex})})),
                reExports: module.reExports.map(ex => ({module: this.generateRef({kind: TypeKinds.REFERENCE, type: ex.module}), references: ex.references.map(r => ({ref: this.generateRef({kind: TypeKinds.REFERENCE, type: r}), alias: r.alias})), alias: ex.alias, reExportsReExport: ex.reExportsReExport}))
            }), { type: "module", module, name: module.name });
            path += `/m.${module.name}`;
        }
        // +1 because class/interface/enum/function/type/constant
        this.depth++;
        for (const classObj of module.classes) {
            this.generateClass(path, classObj);
        }
        for (const interfaceObj of module.interfaces) {
            this.generateInterface(path, interfaceObj);
        }
        for (const enumObj of module.enums) {
            this.generateEnum(path, enumObj);
        }
        for (const typeObj of module.types) {
            this.generateTypeDecl(path, typeObj, module);
        }
        for (const fnObj of module.functions) {
            this.generateFunction(path, fnObj, module);
        }
        for (const constantObj of module.constants) {
            this.generateConstant(path, constantObj, module);
        }
        for (const [, mod] of module.modules) {
            this.generateModule(path, mod);
        }
        this.depth--;
    }

    generateClass(path: string, classObj: ClassDecl) : void {
        if (classObj.isCached) return;
        this.generatePage(path, "class", classObj.id ? `${classObj.name}_${classObj.id}` : classObj.name, 
            this.structure.components.class({
                ...classObj,
                properties: classObj.properties.map(p => this.generatePropertyMember(p)),
                methods: classObj.methods.map(m => this.generateMethodMember(m)),
                comment: this.generateComment(classObj.jsDoc),
                typeParameters: classObj.typeParameters?.map(p => this.generateTypeParameter(p)),
                implements: classObj.implements?.map(impl => this.generateType(impl)),
                extends: classObj.extends && this.generateType(classObj.extends),
                constructor: classObj._constructor && this.generateConstructor(classObj._constructor),
                definedIn: getPathFileName(classObj.loc.sourceFile)
            }), {properties: classObj.properties, name: classObj.name, methods: classObj.methods, type: "class" });
    }

    generateConstructor(constructor: Omit<FunctionDecl, "name">) : string {
        return this.structure.components.classConstructor({
            ...constructor,
            signatures: constructor.signatures.map(sig => this.generateSignature(sig))
        });
    }

    generateInterface(path: string, interfaceObj: InterfaceDecl) : void {
        if (interfaceObj.isCached) return;
        this.generatePage(path, "interface", interfaceObj.id ? `${interfaceObj.name}_${interfaceObj.id}` : interfaceObj.name, this.structure.components.interface({
            ...interfaceObj, 
            properties: interfaceObj.properties.map(p => this.generateProperty(p, true)),
            extends: interfaceObj.extends && interfaceObj.extends.map(ext => this.generateType(ext)),
            implements: interfaceObj.implements && interfaceObj.implements.map(impl => this.generateType(impl)),
            typeParameters: interfaceObj.typeParameters?.map(p => this.generateTypeParameter(p)),
            comment: this.generateComment(interfaceObj.jsDoc),
            definedIn: interfaceObj.loc.map(loc => ({filename: getPathFileName(loc.sourceFile), link: loc.sourceFile}))
        }), {properties: interfaceObj.properties, name: interfaceObj.name, type: "interface" });
    }

    generateEnum(path: string, enumObj: EnumDecl) : void {
        if (enumObj.isCached) return;
        this.generatePage(path, "enum", enumObj.id ? `${enumObj.name}_${enumObj.id}` : enumObj.name, this.structure.components.enum({
            ...enumObj,
            comment: this.generateComment(enumObj.jsDoc),
            members: enumObj.members.map(m => ({...m, initializer: m.initializer && this.generateType(m.initializer), comment: this.generateComment(m.jsDoc)})),
            definedIn: enumObj.loc.map(loc => ({filename: getPathFileName(loc.sourceFile), link: loc.sourceFile}))
        }), { type: "enum", members: enumObj.members, name: enumObj.name });
    }

    generateTypeDecl(path: string, typeObj: TypeDecl, module: Module) : void {
        if (typeObj.isCached) return;
        this.generatePage(path, "type", typeObj.id ? `${typeObj.name}_${typeObj.id}` : typeObj.name, this.structure.components.type({
            ...typeObj,
            comment: this.generateComment(typeObj.jsDoc),
            value: typeObj.value && this.generateType(typeObj.value),
            typeParameters: typeObj.typeParameters?.map(typeParam => this.generateTypeParameter(typeParam)),
            definedIn: getPathFileName(typeObj.loc.sourceFile)
        }), { type: "module", module, name: typeObj.name, realType: "type" });
    }

    generateFunction(path: string, func: FunctionDecl, module: Module) : void {
        if (func.isCached) return;
        this.generatePage(path, "function", func.id ? `${func.name}_${func.id}` : func.name, this.structure.components.function({
            ...func,
            signatures: func.signatures.map(sig => this.generateSignature(sig)),
            typeParameters: func.signatures[0].typeParameters?.map(p => this.generateTypeParameter(p)),
            definedIn: getPathFileName(func.loc.sourceFile)
        }), { type: "module", module, name: func.name, realType: "function" });
    }

    generateConstant(path: string, constant: ConstantDecl, module: Module) : void {
        if (constant.isCached) return;
        this.generatePage(path, "constant", constant.id ? `${constant.name}_${constant.id}` : constant.name, this.structure.components.constant({
            ...constant,
            comment: this.generateComment(constant.jsDoc),
            type: constant.type && this.generateType(constant.type),
            content: constant.content && Highlight.highlight(constant.content, { language: "ts" }).value,
            definedIn: getPathFileName(constant.loc.sourceFile)
        }), { type: "module", module, name: constant.name, realType: "constant" });
    }

    generatePropertyMember(property: ClassProperty|IndexSignatureDeclaration) : string {
        if ("key" in property) {
            return this.structure.components.propertyMember({
                ...property,
                type: property.type && this.generateType(property.type),
                key: property.key && this.generateType(property.key)
            });
        } else return this.structure.components.propertyMember({
            ...property,
            comment: this.generateComment((property as ClassProperty).jsDoc, {example: true}),
            type: property.type && this.generateType(property.type),
            initializer: (property as ClassProperty).initializer && this.generateType((property as ClassProperty).initializer!)
        });
    }

    generateProperty(property: ObjectProperty, isInterface?: boolean) : string {
        const comp = isInterface ? this.structure.components.interfaceProperty : this.structure.components.objectProperty;
        if (property.prop) {
            return comp({
                isProperty: true,
                ...property.prop,
                type: property.prop.type && this.generateType(property.prop.type),
                comment: this.generateComment(property.jsDoc, { example: true })
            });
        } else if (property.index) {
            return comp({
                isIndex: true,
                ...property.index,
                type: this.generateType(property.index.type),
                index: property.index.key && this.generateType(property.index.key),
                comment: this.generateComment(property.jsDoc, { example: true })
            });
        } else if (property.call) {
            return comp({
                isCall: true,
                ...property.call,
                content: this.generateConstructType(property.call, false),
                comment: this.generateComment(property.jsDoc, { example: true })
            });
        } else if (property.construct) {
            return comp({
                isConstruct: true,
                ...property.construct,
                content: this.generateConstructType(property.construct, true),
                comment: this.generateComment(property.jsDoc, { example: true })
            });
        }
        return "";
    }

    generateConstructType(ref: FunctionSignature|ConstructorType, includeNew?: boolean) : string {
        return this.structure.components.typeConstruct({
            parameters: ref.parameters?.map(param => this.generateParameter(param)),
            typeParameters: ref.typeParameters?.map(typeP => this.generateTypeParameter(typeP)),
            returnType: ref.returnType && this.generateType(ref.returnType),
            includeNew
        });
    }

    generateMethodMember(method: ClassMethod) : string {
        return this.structure.components.methodMember({
            ...method,
            name: typeof method.name === "string" ? method.name : this.generateType(method.name),
            rawName: method.realName || method.name,
            isDeprecated: method.jsDoc && hasTagFromJSDoc("deprecated", method.jsDoc),
            signatures: method.signatures.map(sig => this.generateSignature(sig))
        });
    }

    generateRef(ref: Reference, other: Record<string, unknown> = {}) : string {
        if (ref.type.link) return this.structure.components.typeReference({...ref, typeParameters: ref.typeArguments?.map(param => this.generateType(param))});
        let refType: string;
        switch (ref.type.kind) {
        case TypeReferenceKinds.STRINGIFIED_UNKNOWN: return ref.type.name;
        case TypeReferenceKinds.CLASS:
            refType = "class";
            break;
        case TypeReferenceKinds.INTERFACE:
            refType = "interface";
            break;
        case TypeReferenceKinds.ENUM:
        case TypeReferenceKinds.ENUM_MEMBER:
            refType = "enum";
            break;
        case TypeReferenceKinds.TYPE_ALIAS:
            refType = "type";
            break;
        case TypeReferenceKinds.FUNCTION:
            refType = "function";
            break;
        case TypeReferenceKinds.CONSTANT:
            refType = "constant";
            break;
        case TypeReferenceKinds.NAMESPACE_OR_MODULE: {
            if (!ref.type.path) return ref.type.name;
            return this.structure.components.typeReference({
                ...ref, ...other,
                link: ref.type.path && this.generateLink(path.join(...ref.type.path.map(p => `m.${p}`), ref.type.path[ref.type.path.length - 1] !== ref.type.name ? `m.${ref.type.name}`:"", "index.html"))
            });
        }
        default: refType = "";
        }
        return this.structure.components.typeReference({
            ...ref, ...other,
            link: ref.type.path && this.generateLink(path.join(...ref.type.path.map(p => `m.${p}`), refType, `${ref.type.name}${ref.type.id ? `_${ref.type.id}`:""}.html`), ref.type.displayName),
            typeParameters: ref.typeArguments?.map(param => this.generateType(param)),
        });
    }

    generateArrowFunction(ref: ArrowFunction) : string {
        return this.structure.components.typeFunction({
            typeParameters: ref.typeParameters?.map(param => this.generateTypeParameter(param)),
            parameters: ref.parameters?.map(param => this.generateParameter(param)),
            returnType: ref.returnType && this.generateType(ref.returnType)
        });
    }

    generateType(type: Type, other: Record<string, unknown> = {}) : string {
        switch (type.kind) {
        case TypeKinds.REFERENCE: return this.generateRef(type as Reference, other);
        case TypeKinds.ARROW_FUNCTION: return this.generateArrowFunction(type as ArrowFunction);
        case TypeKinds.UNION: {
            const ref = type as UnionOrIntersection;
            return this.structure.components.typeUnion({
                types: ref.types.map(t => this.generateType(t)),
            });
        }
        case TypeKinds.INTERSECTION: {
            const ref = type as UnionOrIntersection;
            return this.structure.components.typeIntersection({
                types: ref.types.map(t => this.generateType(t))
            });
        }
        case TypeKinds.TUPLE: {
            const ref = type as Tuple;
            return this.structure.components.typeTuple({
                types: ref.types.map(t => this.generateType(t)),
                isLarge: isLargeArr(ref.types)
            });
        }
        case TypeKinds.ARRAY_TYPE: {
            const ref = type as ArrayType;
            return this.structure.components.typeArray({type: this.generateType(ref.type) });
        }
        case TypeKinds.MAPPED_TYPE: {
            const ref = type as MappedType;
            return this.structure.components.typeMapped({
                typeParameter: ref.typeParameter,
                optional: ref.optional,
                constraint: ref.constraint && this.generateType(ref.constraint),
                type: ref.type && this.generateType(ref.type)
            });
        }
        case TypeKinds.CONDITIONAL_TYPE: {
            const ref = type as ConditionalType;
            return this.structure.components.typeConditional({
                checkType: this.generateType(ref.checkType),
                extendsType: this.generateType(ref.extendsType),
                trueType: this.generateType(ref.trueType),
                falseType: this.generateType(ref.falseType)
            });
        }
        case TypeKinds.TYPE_PREDICATE: {
            const ref = type as TypePredicateType;
            return this.structure.components.typePredicate({
                parameter: typeof ref.parameter === "string" ? ref.parameter:this.generateType(ref.parameter),
                type: ref.type && this.generateType(ref.type)
            });
        }
        case TypeKinds.INDEX_ACCESS: {
            const ref = type as IndexAccessedType;
            return this.structure.components.typeIndexAccess({index: this.generateType(ref.index), object: this.generateType(ref.object)});
        }
        case TypeKinds.INFER_TYPE: {
            return this.structure.components.typeOperator({name: "infer", type: this.generateTypeParameter((type as InferType).typeParameter)});       
        }
        case TypeKinds.UNIQUE_OPERATOR:
            return this.structure.components.typeOperator({name: "unique", type: this.generateType((type as TypeOperator).type)});       
        case TypeKinds.KEYOF_OPERATOR:
            return this.structure.components.typeOperator({name: "keyof", type: this.generateType((type as TypeOperator).type)}); 
        case TypeKinds.READONLY_OPERATOR:
            return this.structure.components.typeOperator({name: "readonly", type: this.generateType((type as TypeOperator).type)}); 
        case TypeKinds.TYPEOF_OPERATOR:
            return this.structure.components.typeOperator({name: "typeof", type: this.generateType((type as TypeOperator).type)}); 
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
        case TypeKinds.ANY: {
            return this.structure.components.typePrimitive({...type});
        }
        case TypeKinds.OBJECT_LITERAL: {
            const ref = type as ObjectLiteral;
            return this.structure.components.typeObject({
                properties: ref.properties.map(p => this.generateProperty(p)),
                isLarge: isLargeObject(ref)
            });
        }
        case TypeKinds.CONSTRUCTOR_TYPE: return this.generateConstructType((type as ConstructorType), true);
        case TypeKinds.STRINGIFIED_UNKNOWN: return escapeHTML((type as Literal).name);
        default: return "unknown";
        }
    }

    generateSignature(sig: FunctionSignature) : Record<string, unknown> {
        const returnTag = sig.jsDoc && getTagFromJSDoc("returns", sig.jsDoc);
        return {
            parameters: sig.parameters?.map(p => this.generateParameter(p)),
            typeParameters: sig.typeParameters?.map(p => this.generateTypeParameter(p)),
            paramComments: sig.parameters?.filter(param => param.jsDoc.comment).map(param => ({name: param.name, comment:  param.jsDoc.comment && marked.parseInline(param.jsDoc.comment)})),
            returnType: (returnTag && returnTag.type) ? this.generateType(returnTag.type) : sig.returnType && this.generateType(sig.returnType),
            comment: this.generateComment(sig.jsDoc, {example: true, returns: true}),
            isLarge: isLargeSignature(sig)
        };
    }

    generateTypeParameter(type: TypeParameter) : string {
        return this.structure.components.typeParameter({
            default: type.default && this.generateType(type.default),
            constraint: type.constraint && this.generateType(type.constraint),
            name: type.name
        });
    }

    generateParameter(type: FunctionParameter) : string {
        return this.structure.components.functionParameter({
            ...type,
            raw: type,
            defaultValue: type.defaultValue && this.generateType(type.defaultValue),
            type: type.type && this.generateType(type.type)
        });
    }

    generateComment(comment?: Array<JSDocData>, generate?: {
        example?: boolean,
        returns?: boolean
    }) : string|undefined {
        if (!comment) return undefined;
        let text = marked.parse(comment.map(c => c.comment || "").join("\n\n"));
        if (generate) {
            if (generate.example) {
                const example = getTagFromJSDoc("example", comment);
                if (example && example.comment) text += marked.parse(`# Example\n\n${example.comment}`); 
            } 
            if (generate.returns) {
                const returns = getTagFromJSDoc("returns", comment);
                if (returns && returns.comment) text += marked.parse(`# Returns\n\n${returns.comment}`); 
            }
        }
        return text;
    }

    generateMarkdownWithHeaders(content: string) : [string, Array<Heading>] {
        const headings: Array<Heading> = [];
        const markdown = marked.parse(content, {headings});
        return [markdown, headings];
    }

    generatePage(p: string, directory: string, file: string, content: string, other: OtherProps = {}) : string {
        return createFile(path.join(this.settings.out as string, p), directory, `${file}.html`, this.structure.index({
            content,
            headerName: this.settings.name,
            headerRepository: this.landingPage.repository,
            headerHomepage: this.landingPage.homepage,
            headerVersion: this.landingPage.version,
            path: !other.doNotGivePath && [p, file !== "index" ? file:directory],
            depth: this.depth,
            currentGlobalModuleName: this.currentGlobalModuleName,
            logo: this.settings.logo,
            hasChangelog: this.settings.changelog,
            activeBranch: this.activeBranch,
            ...other
        }));
    }

    generateLink(p: string, hash?: string) : string {
        return `${path.join("../".repeat(this.depth), p)}${hash ? `#.${hash}`:""}`;
    }

}