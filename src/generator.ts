
import {ExtractorList} from "@ts-docs/extractor/dist/extractor/ExtractorList";
import { ClassDecl, ClassProperty, Module, Reference, Type, TypeKinds, ArrowFunction, TypeParameter, FunctionParameter } from "@ts-docs/extractor/dist/structure";
import Handlebars, { template } from "handlebars";
import { TsDocsOptions } from ".";
import { DocumentStructure } from "./documentStructure";
import marked from "marked";
import fs from "fs";

function generate(packages: ExtractorList, structure: DocumentStructure, settings: TsDocsOptions) : void {
    const currentContent = "";
    Handlebars.registerHelper("content", () => {
        console.log(currentContent);
        return currentContent;
    });

    
}

function generateModule(path: string, module: Module, structure: DocumentStructure) {
    path = path + `/m.${module.name}`;
    for (const [key, classObj] of module.classes) {

    }
}

function generateClass(path: string, classObj: ClassDecl, structure: DocumentStructure) {
    const classDel = structure.components.class;
    if (!classDel) return;
    const properties = [];
    for (const prop of classObj.properties) properties.push(generatePropertyMember(prop, structure));

}

function generatePropertyMember(property: ClassProperty, structure: DocumentStructure) : string {
    const propDel = structure.components.propertyMember;
    if (!propDel) return "";
    return propDel({
        ...property,
        comment: property.jsDoc && marked.parse(property.jsDoc.map(doc => doc.comment).join("\n\n")),
        type: property.type && generateType(property.type, structure)
    });
}

function generateType(type: Type, structure: DocumentStructure) : string {
    switch (type.kind) {
    case TypeKinds.REFERENCE: {
        const ref = type as Reference;
        if (!structure.components.typeReference) return "";
        return structure.components.typeReference({
            ...ref,
            link: ref.type.path && `${ref.type.external ? ref.type.external:""}${ref.type.path.map(p => `/m.${p}`)}`,
            typeParameters: ref.typeParameters?.map(param => generateType(param, structure))
        });
    }
    case TypeKinds.ARROW_FUNCTION: {
        const ref = type as ArrowFunction;
        if (!structure.components.typeFunction) return "";
        return structure.components.typeFunction({
            typeParameters: ref.typeParameters?.map(param => generateTypeParameter(param, structure)),
            parameters: ref.parameters?.map(param => generateParameter(param, structure)),
            returnType: ref.returnType && generateType(ref.returnType, structure)
        });
    }
    default: return "";
    }
}

function generateTypeParameter(type: TypeParameter, structure: DocumentStructure) : string {
    if (!structure.components.typeParameter) return "";
    return structure.components.typeParameter({
        default: type.default && generateType(type.default, structure),
        constraint: type.constraint && generateType(type.constraint, structure),
        name: type.name
    });
}

function generateParameter(type: FunctionParameter, structure: DocumentStructure) : string {
    if (!structure.components.functionParameter) return "";
    return structure.components.functionParameter({
        ...type,
        type: type.type && generateType(type.type, structure)
    });
}