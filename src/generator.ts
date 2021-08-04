
import { ClassDecl, ClassProperty, Reference, Type, TypeKinds, ArrowFunction, TypeParameter, FunctionParameter, ClassMethod, JSDocData, Module, TypeReferenceKinds } from "@ts-docs/extractor/dist/structure";
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
            if (pkg.readme) this.generatePage(out, "./", "index", marked.parse(pkg.readme));
        } else {
            for (const pkg of packages) {
                this.generateModule(out, pkg.module);
            }
            if (this.settings.landingPage && this.settings.landingPage.readme) this.generatePage(out, "./", "index", marked.parse(this.settings.landingPage.readme));
        }
    }

    generateModule(path: string, module: Module, createFolder = true) : void {
        this.depth++;
        if (createFolder) path = this.generatePage(path, `m.${module.name}`, "index", this.structure.components.module(module), { type: "module" });
        for (const [, classObj] of module.classes) {
            this.generateClass(path, classObj);
        }
        for (const [, mod] of module.modules) {
            this.generateModule(path, mod);
        }
        this.depth--;
    }

    generateClass(path: string, classObj: ClassDecl) : void {
        if (!this.structure.components.class) return;
        const properties = [];
        const methods = [];
        for (const prop of classObj.properties) properties.push(this.generatePropertyMember(prop));
        for (const method of classObj.methods) methods.push(this.generateMethodMember(method));
        this.generatePage(path, "class", classObj.name || "default export", 
            this.structure.components.class({
                ...classObj,
                properties,
                methods,
                comment: this.generateComment(classObj.jsDoc),
                typeParameters: classObj.typeParameters?.map(p => this.generateTypeParameter(p))
            }), {properties, methods, type: "class"});
    }

    generatePropertyMember(property: ClassProperty) : string {
        if (!this.structure.components.propertyMember) return "";
        return this.structure.components.propertyMember({
            ...property,
            comment: this.generateComment(property.jsDoc),
            type: property.type && this.generateType(property.type)
        });
    }

    generateMethodMember(method: ClassMethod) : string {
        if (!this.structure.components.methodMember) return "";
        return this.structure.components.methodMember({
            ...method,
            parameters: method.parameters?.map(p => this.generateParameter(p)),
            typeParameters: method.typeParameters?.map(p => this.generateTypeParameter(p)),
            returnType: method.returnType && this.generateType(method.returnType)
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
                link: ref.type.path && this.generateLink(`${ref.type.external ? `/${ref.type.external}/`:""}${ref.type.path.map(p => `m.${p}/`).join("")}${refType}/${ref.type.name}.html`),
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
            name: this.settings.name,
            repository: this.settings.landingPage?.repository,
            homepage: this.settings.landingPage?.homepage
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