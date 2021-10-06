import { FileObjectCache } from "@ts-docs/extractor";
import fs from "fs";
import path from "path";
import { TsDocsOptions } from ".";

/**
* filename - last modified timestamp
*/
export type FileCacheStructure = Record<string, number> 


const FILE_CACHE_NAME = "__fileCache.json";

export class FileCache implements FileObjectCache {
    data: FileCacheStructure
    newData: FileCacheStructure
    path: string
    constructor(options: TsDocsOptions) {
        this.path = path.join(options.out, FILE_CACHE_NAME);
        if (fs.existsSync(this.path)) {
            this.data = JSON.parse(fs.readFileSync(this.path, "utf-8"));
        }
        else this.data = {};
        this.newData = {};
    }

    has(filename: string, path: string) : boolean {
        const entry = this.data[filename];
        try {
            const stats = fs.statSync(path);
            if (!entry || stats.mtimeMs > entry) {
                this.newData[filename] = stats.mtimeMs;
                return false;
            }
            return true;
        } catch {
            return false;
        }
    }

    save() : void {
        fs.writeFileSync(this.path, JSON.stringify(Object.assign(this.data, this.newData)));
    }
}