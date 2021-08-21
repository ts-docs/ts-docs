
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
