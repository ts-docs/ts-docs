
import { ArrowFunction, FunctionParameter, ObjectLiteral, Reference, Type, TypeKinds, UnionOrIntersection } from "@ts-docs/extractor/dist/structure";
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

export function isLargeType(type: Type) : boolean {
    switch (type.kind) {
    case TypeKinds.REFERENCE: return (type as Reference).type.name.length > 24 || ((type as Reference).typeParameters?.some(typeParam => isLargeType(typeParam)) || false);
    case TypeKinds.OBJECT_LITERAL: return (type as ObjectLiteral).properties.length > 2 || (type as ObjectLiteral).properties.some(prop => prop.type && prop.type.kind === TypeKinds.REFERENCE && (prop.type as Reference).type.name.length > 12);
    case TypeKinds.ARROW_FUNCTION: {
        const parameters = (type as ArrowFunction).parameters;
        if (!parameters) return false;
        return parameters.length > 3 || parameters.some(p => p.type && isLargeType(p.type));
    }
    case TypeKinds.UNION:
    case TypeKinds.INTERSECTION:
        return (type as UnionOrIntersection).types.some(t => isLargeType(t));
    default: return false;
    }
}

export function isLargeSignature(sig: { parameters?: Array<FunctionParameter>, returnType?: Type }) : boolean {
    if (sig.returnType) return isLargeType(sig.returnType); 
    if (sig.parameters) {
        if (sig.parameters.length > 2) return true;
        return sig.parameters.some(p => {
            if (p.name.length > 20) return true;
            else if (p.type) return isLargeType(p.type);
            return false;
        });
    }
    return false;
}