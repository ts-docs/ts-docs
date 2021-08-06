
import { ClassDecl, ClassProperty, Reference, Type, TypeKinds, ArrowFunction, TypeParameter, FunctionParameter, ClassMethod, JSDocData, Module, TypeReferenceKinds, UnionOrIntersection, Tuple, ObjectLiteral, InterfaceProperty, IndexSignatureDeclaration, InterfaceDecl } from "@ts-docs/extractor/dist/structure";
import { TsDocsOptions } from ".";
import { DocumentStructure } from "./documentStructure";
import marked from "marked";
import { createFile } from "./utils";
import { ExtractorList } from "@ts-docs/extractor";
//import HTMLMinifier from "html-minifier";


export class Generator {
    structure: DocumentStructure
    settings: TsDocsOptions
    depth: number
    constructor(structure: DocumentStructure, settings: TsDocsOptions) {
        this.structure = structure;
        this.settings = settings;
        this.depth = 0;
    }

    generate(packages: ExtractorList) : void {
        const out = this.settings.out as string;
        if (packages.length === 1) {
            const pkg = packages[0];
            this.generateModule(out, pkg.module, false);
            if (pkg.readme) this.generatePage(out, "./", "index", marked.parse(pkg.readme), { type: "module", ...pkg.module });
        } else {
            for (const pkg of packages) {
                this.generateModule(out, pkg.module);
            }
            if (this.settings.landingPage && this.settings.landingPage.readme) this.generatePage(out, "./", "index", marked.parse(this.settings.landingPage.readme), { type: "index", packages });
        }
    }

    generateModule(path: string, module: Module, createFolder = true) : void {
        this.depth++;
        if (createFolder) path = this.generatePage(path, `m.${module.name}`, "index", this.structure.components.module(module), { type: "module", ...module });
        for (const [, classObj] of module.classes) {
            this.generateClass(path, classObj);
        }
        for (const [, interfaceObj] of module.interfaces) {
            this.generateInterface(path, interfaceObj);
        }
        for (const [, mod] of module.modules) {
            this.generateModule(path, mod);
        }
        this.depth--;
    }

    generateClass(path: string, classObj: ClassDecl) : void {
        if (!this.structure.components.class) return;
        this.generatePage(path, "class", classObj.name || "default export", 
            this.structure.components.class({
                ...classObj,
                properties: classObj.properties.map(p => this.generatePropertyMember(p)),
                methods: classObj.methods.map(m => this.generateMethodMember(m)),
                comment: this.generateComment(classObj.jsDoc),
                typeParameters: classObj.typeParameters?.map(p => this.generateTypeParameter(p)),
                extends: classObj.extends && this.generateType(classObj.extends)
            }), {properties: classObj.properties, methods: classObj.methods, type: "class"});
    }

    generateInterface(path: string, interfaceObj: InterfaceDecl) : void {
        if (!this.structure.components.interface) return;
        this.generatePage(path, "interface", interfaceObj.name!, this.structure.components.interface({
            ...interfaceObj, 
            properties: interfaceObj.properties.map(p => this.generateProperty(p)),
            extends: interfaceObj.extends && this.generateType(interfaceObj.extends),
            implements: interfaceObj.implements && interfaceObj.implements.map(impl => this.generateType(impl)),
            typeParameters: interfaceObj.typeParameters?.map(p => this.generateTypeParameter(p)),
            comment: this.generateComment(interfaceObj.jsDoc)
        }), {properties: interfaceObj.properties, type: "interface"});
    }

    generatePropertyMember(property: ClassProperty) : string {
        if (!this.structure.components.propertyMember) return "";
        return this.structure.components.propertyMember({
            ...property,
            comment: this.generateComment(property.jsDoc),
            type: property.type && this.generateType(property.type)
        });
    }

    generateProperty(property: InterfaceProperty|IndexSignatureDeclaration) : string {
        if (!this.structure.components.interfaceProperty) return "";
        return this.structure.components.interfaceProperty({
            ...property,
            type: property.type && this.generateType(property.type)
        });
    }

    generateMethodMember(method: ClassMethod) : string {
        if (!this.structure.components.methodMember) return "";
        return this.structure.components.methodMember({
            ...method,
            signatures: method.signatures.map(sig => ({
                parameters: sig.parameters?.map(p => this.generateParameter(p)),
                typeParameters: sig.typeParameters?.map(p => this.generateTypeParameter(p)),
                returnType: sig.returnType && this.generateType(sig.returnType)
            }))
        });
    }

    generateType(type: Type) : string {
        switch (type.kind) {
        case TypeKinds.REFERENCE: {
            const ref = type as Reference;
            if (!this.structure.components.typeReference) return "";
            let refType: string;
            switch (ref.type.kind) {
            case TypeReferenceKinds.CLASS:
                refType = "class";
                break;
            case TypeReferenceKinds.INTERFACE:
                refType = "interface";
                break;
            case TypeReferenceKinds.ENUM:
                refType = "enum";
                break;
            case TypeReferenceKinds.TYPE_ALIAS:
                refType = "type";
                break;
            default: refType = "";
            }
            return this.structure.components.typeReference({
                ...ref,
                link: ref.type.path && this.generateLink(`${ref.type.external ? `../../m.${ref.type.external}/`:""}${ref.type.path.map(p => `m.${p}/`).join("")}${refType}/${ref.type.name}.html`),
                typeParameters: ref.typeParameters?.map(param => this.generateType(param))
            });
        }
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
        case TypeKinds.STRING: return "string";
        case TypeKinds.NUMBER: return "number";
        case TypeKinds.VOID: return "void";
        case TypeKinds.TRUE: return "true";
        case TypeKinds.FALSE: return "false";
        case TypeKinds.BOOLEAN: return "boolean";
        case TypeKinds.UNDEFINED: return "undefined";
        case TypeKinds.NULL: return "null";
        case TypeKinds.UNKNOWN: return "unknown";
        case TypeKinds.ANY: return "any";
        case TypeKinds.OBJECT_LITERAL: {
            const ref = type as ObjectLiteral;
            if (!this.structure.components.typeObject) return "";
            return this.structure.components.typeObject({
                properties: ref.properties.map(p => this.generateProperty(p))
            });
        }
        default: return "";
        }
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
            type: type.type && this.generateType(type.type)
        });
    }

    generateComment(comment?: Array<JSDocData>) : string|undefined {
        if (!comment) return undefined;
        return marked.parse(comment.map(c => c.comment || "").join("\n\n"));
    }

    generatePage(path: string, directory: string, file: string, content: string, other: Record<string, unknown> = {}) : string {
        return createFile(path, directory, `${file}.html`, this.generateHTML(this.structure.index({
            ...other,
            content,
            headerName: this.settings.name,
            headerRepository: this.settings.landingPage?.repository,
            headerHomepage: this.settings.landingPage?.homepage
        })));
    }

    generateHTML(content: string) : string {
        return content;
        //return HTMLMinifier.minify(content, {collapseWhitespace: true, minifyCSS: true, minifyURLs: true, minifyJS: true, removeComments: true, useShortDoctype: true});
    }

    generateLink(path: string) : string {
        return `${"../".repeat(this.depth)}/${path}`;
    }


}