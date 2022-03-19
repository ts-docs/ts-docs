import fs from "fs";
import path from "path";
import { DocumentStructure } from "..";

/**
 * @since 4.0.1
 */
export interface FileHost {
    /**
     * Checks if the provided path exists.
     */
    exists(path: string) : boolean;
    /**
    * Creates a file with the name `fileName`, which is located inside `folderName`, which gets created if 
    * it doesn't already exist. The `folder` is located in the `basePath`.
    * 
    * @returns The `basePath` + `folderName`.
    */
    createFile(basePath: string, folderName: string, fileName: string, content: string) : string;
    /**
     * Copies an entire folder and everything inside it, including contents of sub-folders.
     */
    copyFolder(origin: string, destination: string) : void;
    /**
     * Creates a folder **only** if it doesn't already exists.
     * 
     * @returns The `path` + `name`
     */
    createDir(path: string, name: string) : string;
    /**
     * @returns The documentation structure object, or `false` to let ts-docs find it on it's own. Keep in mind
     * it won't use the methods provided by the file host. 
     */
    getDocumentStructure(name: string) : DocumentStructure | false;
    readFile(path: string) : string;
    writeFile(path: string, content: string) : void;
}

/**
 * File system file host. The default file host used by ts-docs.
 */
export const FSFileHost: FileHost = {
    exists: (path) => fs.existsSync(path),
    createFile: (basePath, folder, file, content) => {
        const folderPath = path.join(basePath, folder);
        if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);
        fs.writeFileSync(path.join(folderPath, file), content, "utf-8");
        return folderPath;
    },
    copyFolder: (origin, destination) => {
        for (const file of fs.readdirSync(origin, {withFileTypes: true})) {
            const newOrigin = path.join(origin, file.name);
            const newDestination = path.join(destination, file.name);
            if (file.isDirectory()) {
                if (!fs.existsSync(newDestination)) fs.mkdirSync(newDestination);
                FSFileHost.copyFolder(newOrigin, newDestination);
            }
            else fs.copyFileSync(newOrigin, newDestination);
        }
    },
    readFile: (path) => fs.readFileSync(path, "utf-8"),
    createDir: (p, name) => {
        const finalP = path.join(p, name);
        if (!fs.existsSync(finalP)) fs.mkdirSync(finalP);
        return finalP;
    },
    writeFile: (path, content) => fs.writeFileSync(path, content),
    getDocumentStructure: () => false
};