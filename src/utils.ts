
import { ArrayType, ArrowFunction, FunctionParameter, Literal, ObjectLiteral, Property, Reference, Tuple, Type, TypeKinds, TypeOperator, UnionOrIntersection } from "@ts-docs/extractor/dist/structure";
import fs from "fs";
import path from "path";

export function createFile(basePath: string, folder: string, file: string, content: string) : string {
    const folderPath = path.join(basePath, folder);
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);
    fs.writeFileSync(path.join(folderPath, file), content, "utf-8");
    return folderPath;
}

export function findTSConfig<T = string>(basePath: string) : Record<string, T>|undefined {
    const p = path.join(basePath, "tsconfig.json");
    if (fs.existsSync(p)) return require(p);
    const newPath = path.join(basePath, "../");
    if (basePath === newPath) return undefined;
    return findTSConfig(newPath);
}

export function copyFolder(origin: string, destination: string) : void {
    for (const file of fs.readdirSync(origin, {withFileTypes: true})) {
        const newOrigin = path.join(origin, file.name);
        const newDestination = path.join(destination, file.name);
        if (file.isDirectory()) {
            const dest = path.join(process.cwd(), newDestination);
            if (!fs.existsSync(dest)) fs.mkdirSync(path.join(process.cwd(), newDestination));
            copyFolder(newOrigin, newDestination);
        }
        else fs.copyFileSync(newOrigin, newDestination);
    }
}

export function escapeHTML(html: string) : string {
    return html.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;") ;
}

export function getTypeLength(type?: Type) : number {
    if (!type) return 0;
    switch (type.kind) {
    case TypeKinds.REFERENCE: return (type as Reference).type.name.length + ((type as Reference).typeParameters?.reduce((acc, t) => acc + getTypeLength(t), 0) || 0);
    case TypeKinds.OBJECT_LITERAL: return (type as ObjectLiteral).properties.reduce((acc, prop) => acc + (("key" in prop) ? getTypeLength(prop.type) : ((prop as Property).name.length + getTypeLength((prop as Property).type))), 0);
    case TypeKinds.ARROW_FUNCTION: {
        const fn = (type as ArrowFunction);
        let total = getTypeLength(fn.returnType);
        if (fn.parameters) {
            for (const param of fn.parameters) {
                total += param.name.length;
                if (param.defaultValue) total += getTypeLength(param.defaultValue);
                if (param.type) total += getTypeLength(param.type);
                if (param.rest) total += 3;
            }
        }
        return total;
    }
    case TypeKinds.INTERSECTION:
    case TypeKinds.UNION:
        return (type as UnionOrIntersection).types.reduce((acc, t) => acc + getTypeLength(t), 0);
    case TypeKinds.STRING_LITERAL:
    case TypeKinds.NUMBER_LITERAL:
    case TypeKinds.STRINGIFIED_UNKNOWN: return (type as Literal).name.length;    
    case TypeKinds.ARRAY_TYPE: return getTypeLength((type as ArrayType).type);
    case TypeKinds.TRUE: return 4;
    case TypeKinds.FALSE: return 5;
    case TypeKinds.STRING:
    case TypeKinds.NUMBER: return 6;
    case TypeKinds.BOOLEAN:
    case TypeKinds.UNKNOWN: return 7;
    case TypeKinds.BIGINT: return 6;
    case TypeKinds.TUPLE: return (type as Tuple).types.reduce((acc, t) => acc + getTypeLength(t), 0);
    case TypeKinds.TYPEOF_OPERATOR:
    case TypeKinds.KEYOF_OPERATOR:
    case TypeKinds.UNIQUE_OPERATOR:
    case TypeKinds.READONLY_OPERATOR:
        return getTypeLength((type as TypeOperator).type);
    default: return 0;
    }
}

export function isLargeSignature(sig: { parameters?: Array<FunctionParameter>, returnType?: Type }) : boolean {
    if (sig.parameters) {
        if (sig.parameters.length > 3) return true;
        const total = sig.parameters.reduce((acc, param) => acc + param.name.length + getTypeLength(param.type) + getTypeLength(param.defaultValue), getTypeLength(sig.returnType));
        if (total > 65) return true;
    }
    return false;
}