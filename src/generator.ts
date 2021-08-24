
import { ClassDecl, ClassProperty, Reference, Type, TypeKinds, ArrowFunction, TypeParameter, FunctionParameter, ClassMethod, JSDocData, Module, TypeReferenceKinds, UnionOrIntersection, Tuple, ObjectLiteral, InterfaceProperty, IndexSignatureDeclaration, InterfaceDecl, EnumDecl, Literal, ArrayType, TypeDecl, FunctionDecl, ConstantDecl, ConditionalType, MappedType, TypeOperator, IndexAccessedType, Constructor, FunctionSignature } from "@ts-docs/extractor/dist/structure";
import { DocumentStructure } from "./documentStructure";
import marked from "marked";
import { copyFolder, createFile, escapeHTML, isLargeSignature } from "./utils";
import { ExtractorList } from "@ts-docs/extractor";
import path from "path";
import { TsDocsOptions } from "./options";
import fs from "fs";
import Highlight from "highlight.js";
import { Heading, initMarkdown } from "./markdown";
import { packSearchData } from "./searchData";

export interface OtherProps {
    [key: string]: unknown,
    doNotGivePath?: boolean,
    depth?: number,
    type?: string
}

export class Generator {
    structure: DocumentStructure
    settings: TsDocsOptions
    depth: number
    currentGlobalModuleName?: string
    constructor(structure: DocumentStructure, settings: TsDocsOptions) {
        this.structure = structure;
        this.settings = settings;
        this.depth = 0;
    }

    generate(packages: ExtractorList) : void {
        initMarkdown(this, packages);
        if (fs.existsSync(this.settings.out)) fs.rmSync(this.settings.out, { force: true, recursive: true });
        fs.mkdirSync(this.settings.out);

        const assetsFolder = path.join(this.settings.out, "assets");
        fs.mkdirSync(assetsFolder);
        if (this.settings.assets) copyFolder(this.settings.assets, assetsFolder);
        copyFolder(path.join(this.structure.path, "assets"), assetsFolder);

        packSearchData(packages, `${assetsFolder}/search.json`);

        if (this.settings.customPages) {
            fs.mkdirSync(path.join(this.settings.out, "./pages"));
            for (const category of this.settings.customPages) {
                for (const page of category.pages) {
                    this.depth += 2;
                    const [markdown, headings] = this.generateMarkdownWithHeaders(page.content);
                    this.generatePage("./pages", category.name, page.name, markdown, {
                        type: "page",
                        pages: this.settings.customPages,
                        headings
                    });
                    this.depth -= 2;
                }
            }
        }
        if (packages.length === 1) {
            const pkg = packages[0];
            this.generateModule("", pkg.module, false);
            if (pkg.readme) this.generatePage("", "./", "index", marked.parse(pkg.readme), { type: "module", module: pkg.module, pages: this.settings.customPages, doNotGivePath: true });
        } else {
            for (const pkg of packages) {
                this.currentGlobalModuleName = pkg.module.name;
                this.generateModule("", pkg.module, true, pkg.readme);
            }
            if (this.settings.landingPage && this.settings.landingPage.readme) this.generatePage("", "./", "index", marked.parse(this.settings.landingPage.readme), { type: "index", packages, pages: this.settings.customPages, doNotGivePath: true });
        }
    }

    generateModule(path: string, module: Module, createFolder = true, readme?: string) : void {
        if (createFolder) {
            this.generatePage(path, `m.${module.name}`, "index", this.structure.components.module(readme ? {...module, readme: marked.parse(readme) }:module), { type: "module", module, name: module.name });
            path += `/m.${module.name}`;
        }
        this.depth++;
        for (const [, classObj] of module.classes) {
            this.generateClass(path, classObj);
        }
        for (const [, interfaceObj] of module.interfaces) {
            this.generateInterface(path, interfaceObj);
        }
        for (const [, enumObj] of module.enums) {
            this.generateEnum(path, enumObj);
        }
        for (const [, typeObj] of module.types) {
            this.generateTypeDecl(path, typeObj, module);
        }
        for (const [, fnObj] of module.functions) {
            this.generateFunction(path, fnObj, module);
        }
        for (const [, constantObj] of module.constants) {
            this.generateConstant(path, constantObj, module);
        }
        for (const [, mod] of module.modules) {
            this.generateModule(path, mod);
        }
        this.depth--;
    }

    generateClass(path: string, classObj: ClassDecl) : void {
        if (!this.structure.components.class) return;
        this.generatePage(path, "class", classObj.name, 
            this.structure.components.class({
                ...classObj,
                properties: classObj.properties.map(p => this.generatePropertyMember(p)),
                methods: classObj.methods.map(m => this.generateMethodMember(m)),
                comment: this.generateComment(classObj.jsDoc),
                typeParameters: classObj.typeParameters?.map(p => this.generateTypeParameter(p)),
                implements: classObj.implements?.map(impl => this.generateType(impl)),
                extends: classObj.extends && this.generateType(classObj.extends),
                constructor: classObj.constructor && this.generateConstructor(classObj.constructor),
            }), {properties: classObj.properties, name: classObj.name, methods: classObj.methods, type: "class", depth: this.depth + 1});
    }

    generateConstructor(constructor: Constructor) : string {
        if (!this.structure.components.classConstructor) return "";
        return this.structure.components.classConstructor({
            parameters: constructor.parameters?.map(p => this.generateParameter(p)),
            paramComments: constructor.parameters?.filter(param => param.jsDoc.comment).map(param => ({name: param.name, comment: param.jsDoc.comment})),
            paramsOnNewLine: isLargeSignature(constructor)
        });
    }

    generateInterface(path: string, interfaceObj: InterfaceDecl) : void {
        if (!this.structure.components.interface) return;
        this.generatePage(path, "interface", interfaceObj.name, this.structure.components.interface({
            ...interfaceObj, 
            properties: interfaceObj.properties.map(p => this.generateProperty(p)),
            extends: interfaceObj.extends && this.generateType(interfaceObj.extends),
            implements: interfaceObj.implements && interfaceObj.implements.map(impl => this.generateType(impl)),
            typeParameters: interfaceObj.typeParameters?.map(p => this.generateTypeParameter(p)),
            comment: this.generateComment(interfaceObj.jsDoc)
        }), {properties: interfaceObj.properties, name: interfaceObj.name, type: "interface", depth: this.depth + 1});
    }

    generateEnum(path: string, enumObj: EnumDecl) : void {
        if (!this.structure.components.enum) return;
        this.generatePage(path, "enum", enumObj.name, this.structure.components.enum({
            ...enumObj,
            comment: this.generateComment(enumObj.jsDoc),
            members: enumObj.members.map(m => ({...m, initializer: m.initializer && this.generateType(m.initializer)}))
        }), { type: "enum", members: enumObj.members, name: enumObj.name, depth: this.depth + 1 });
    }

    generateTypeDecl(path: string, typeObj: TypeDecl, module: Module) : void {
        if (!this.structure.components.type) return;
        this.generatePage(path, "type", typeObj.name, this.structure.components.type({
            ...typeObj,
            comment: this.generateComment(typeObj.jsDoc),
            value: typeObj.value && this.generateType(typeObj.value),
            typeParameters: typeObj.typeParameters?.map(typeParam => this.generateTypeParameter(typeParam))
        }), { type: "module", module, name: typeObj.name, realType: "enum",  });
    }

    generateFunction(path: string, func: FunctionDecl, module: Module) : void {
        if (!this.structure.components.function) return;
        this.generatePage(path, "function", func.name, this.structure.components.function({
            ...func,
            signatures: func.signatures.map(sig => this.generateSignature(sig)),
            typeParameters: func.signatures[0].typeParameters?.map(p => this.generateTypeParameter(p))
        }), { type: "module", module, name: func.name, realType: "function" });
    }

    generateConstant(path: string, constant: ConstantDecl, module: Module) : void {
        if (!this.structure.components.constant) return;
        this.generatePage(path, "constant", constant.name, this.structure.components.constant({
            ...constant,
            comment: this.generateComment(constant.jsDoc),
            type: constant.type && this.generateType(constant.type),
            content: constant.content && Highlight.highlight(constant.content, { language: "ts" }).value
        }), { type: "module", module, name: constant.name, realType: "constant" });
    }

    generatePropertyMember(property: ClassProperty) : string {
        if (!this.structure.components.propertyMember) return "";
        return this.structure.components.propertyMember({
            ...property,
            comment: this.generateComment(property.jsDoc),
            type: property.type && this.generateType(property.type),
        });
    }

    generateProperty(property: InterfaceProperty|IndexSignatureDeclaration) : string {
        if (!this.structure.components.interfaceProperty) return "";
        return this.structure.components.interfaceProperty({
            ...property,
            type: property.type && this.generateType(property.type),
            key: "key" in property && property.key && this.generateType(property.key)
        });
    }

    generateMethodMember(method: ClassMethod) : string {
        if (!this.structure.components.methodMember) return "";
        return this.structure.components.methodMember({
            ...method,
            isDeprecated: method.jsDoc?.some(doc => doc.tags?.some(t => t.name === "deprecated")),
            signatures: method.signatures.map(sig => this.generateSignature(sig))
        });
    }

    generateRef(ref: Reference, other: Record<string, unknown> = {}) : string {
        if (!this.structure.components.typeReference) return "";
        let refType: string;
        switch (ref.type.kind) {
        case TypeReferenceKinds.DEFAULT_API: {
            if (!this.structure.components.typeDefaultAPI) return "";
            return this.structure.components.typeDefaultAPI({...ref, typeParameters: ref.typeParameters?.map(param => this.generateType(param))});
        }
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
        default: refType = "";
        }
        return this.structure.components.typeReference({
            ...ref,
            link: ref.type.path && this.generateLink(path.join(ref.type.external ? `../m.${ref.type.external}`:"", ...ref.type.path.map(p => `m.${p}`), refType, `${ref.type.name}.html`), ref.type.displayName),
            typeParameters: ref.typeParameters?.map(param => this.generateType(param)),
            ...other
        });
    }

    generateType(type: Type, other: Record<string, unknown> = {}) : string {
        switch (type.kind) {
        case TypeKinds.REFERENCE: return this.generateRef(type as Reference, other);
        case TypeKinds.ARROW_FUNCTION: {
            const ref = type as ArrowFunction;
            if (!this.structure.components.typeFunction) return "";
            return this.structure.components.typeFunction({
                typeParameters: ref.typeParameters?.map(param => this.generateTypeParameter(param)),
                parameters: ref.parameters?.map(param => this.generateParameter(param)),
                returnType: ref.returnType && this.generateType(ref.returnType)
            });
        }
        case TypeKinds.UNION: {
            const ref = type as UnionOrIntersection;
            if (!this.structure.components.typeUnion) return "";
            return this.structure.components.typeUnion({
                types: ref.types.map(t => this.generateType(t))
            });
        }
        case TypeKinds.INTERSECTION: {
            const ref = type as UnionOrIntersection;
            if (!this.structure.components.typeIntersection) return "";
            return this.structure.components.typeIntersection({
                types: ref.types.map(t => this.generateType(t))
            });
        }
        case TypeKinds.TUPLE: {
            const ref = type as Tuple;
            if (!this.structure.components.typeUnion) return "";
            return this.structure.components.typeUnion({
                types: ref.types.map(t => this.generateType(t))
            });
        }
        case TypeKinds.ARRAY_TYPE: {
            const ref = type as ArrayType;
            if (!this.structure.components.typeArray) return "";
            return this.structure.components.typeArray({type: this.generateType(ref.type) });
        }
        case TypeKinds.MAPPED_TYPE: {
            const ref = type as MappedType;
            if (!this.structure.components.typeMapped) return "";
            return this.structure.components.typeMapped({
                typeParameter: ref.typeParameter,
                optional: ref.optional,
                constraint: ref.constraint && this.generateType(ref.constraint),
                type: ref.type && this.generateType(ref.type)
            });
        }
        case TypeKinds.CONDITIONAL_TYPE: {
            const ref = type as ConditionalType;
            if (!this.structure.components.typeConditional) return "";
            return this.structure.components.typeConditional({
                checkType: this.generateType(ref.checkType),
                extendsType: this.generateType(ref.extendsType),
                trueType: this.generateType(ref.trueType),
                falseType: this.generateType(ref.falseType)
            });
        }
        case TypeKinds.INDEX_ACCESS: {
            const ref = type as IndexAccessedType;
            if (!this.structure.components.typeIndexAccess) return "";
            return this.structure.components.typeIndexAccess({index: this.generateType(ref.index), object: this.generateType(ref.object)});
        }
        case TypeKinds.UNIQUE_OPERATOR:
            if (!this.structure.components.typeOperator) return "";
            return this.structure.components.typeOperator({name: "unique", type: this.generateType((type as TypeOperator).type)});       
        case TypeKinds.KEYOF_OPERATOR:
            if (!this.structure.components.typeOperator) return "";
            return this.structure.components.typeOperator({name: "keyof", type: this.generateType((type as TypeOperator).type)}); 
        case TypeKinds.READONLY_OPERATOR:
            if (!this.structure.components.typeOperator) return "";
            return this.structure.components.typeOperator({name: "readonly", type: this.generateType((type as TypeOperator).type)}); 
        case TypeKinds.TYPEOF_OPERATOR:
            if (!this.structure.components.typeOperator) return "";
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
        case TypeKinds.ANY: {
            if (!this.structure.components.typePrimitive) return "";
            return this.structure.components.typePrimitive({...type});
        }
        case TypeKinds.OBJECT_LITERAL: {
            const ref = type as ObjectLiteral;
            if (!this.structure.components.typeObject) return "";
            return this.structure.components.typeObject({
                properties: ref.properties.map(p => this.generateProperty(p))
            });
        }
        case TypeKinds.STRINGIFIED_UNKNOWN: return escapeHTML((type as Literal).name);
        default: return "unknown";
        }
    }

    generateSignature(sig: FunctionSignature) : Record<string, unknown> {
        return {
            parameters: sig.parameters?.map(p => this.generateParameter(p)),
            typeParameters: sig.typeParameters?.map(p => this.generateTypeParameter(p)),
            paramComments: sig.parameters?.filter(param => param.jsDoc.comment).map(param => ({name: param.name, comment: param.jsDoc.comment})),
            returnType: sig.returnType && this.generateType(sig.returnType),
            comment: this.generateComment(sig.jsDoc),
            paramsOnNewLine: isLargeSignature(sig)
        };
    }

    generateTypeParameter(type: TypeParameter) : string {
        if (!this.structure.components.typeParameter) return "";
        return this.structure.components.typeParameter({
            default: type.default && this.generateType(type.default),
            constraint: type.constraint && this.generateType(type.constraint),
            name: type.name
        });
    }

    generateParameter(type: FunctionParameter) : string {
        if (!this.structure.components.functionParameter) return "";
        return this.structure.components.functionParameter({
            ...type,
            raw: type,
            defaultValue: type.defaultValue && this.generateType(type.defaultValue),
            comment: type.jsDoc.comment,
            type: type.type && this.generateType(type.type)
        });
    }

    generateComment(comment?: Array<JSDocData>) : string|undefined {
        if (!comment) return undefined;
        return marked.parse(comment.map(c => c.comment || "").join("\n\n"));
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
            headerRepository: this.settings.landingPage?.repository,
            headerHomepage: this.settings.landingPage?.homepage,
            headerVersion: this.settings.landingPage?.version,
            path: !other.doNotGivePath && this.generatePath(p, file !== "index" ? file:directory),
            depth: this.depth,
            currentGlobalModuleName: this.currentGlobalModuleName,
            logo: this.settings.logo,
            ...other
        }));
    }

    generateLink(p: string, hash?: string) : string {
        return `${path.join("../".repeat(this.depth), p)}${hash ? `#${hash}`:""}`;
    }

    generatePath(url: string, final: string) : Array<{name: string, path: string}> {
        const parts = url.split("/").slice(1);
        const partsLen = parts.length;
        const res = [{name: "index", path: `${"../".repeat(partsLen + 1)}index.html`}];
        for (let i=0; i < partsLen; i++) {
            const thing = parts[i];
            res.push({
                name: thing.startsWith("m.") ? thing.slice(2):thing,
                path: `${"../".repeat(partsLen - i)}index.html`
            });
        }
        res.push({name: final.startsWith("m.") ? final.slice(2):final , path: ""});
        return res;
    }

}