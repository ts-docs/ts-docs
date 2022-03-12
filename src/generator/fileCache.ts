import { FileObjectCache } from "@ts-docs/extractor";
import fs from "fs";
import path from "path";
import { TsDocsOptions } from "..";

/**
* filename - last modified timestamp
*/
export type FileCacheStructure = Record<string, number|string> 

const FILE_CACHE_NAME = "__fileCache.json";

export class FileCache implements FileObjectCache {
    data: FileCacheStructure
    newData: FileCacheStructure
    path: string
    constructor(options: TsDocsOptions, version: string) {
        this.path = path.join(options.out, FILE_CACHE_NAME);
        if (fs.existsSync(this.path)) {
            this.data = JSON.parse(fs.readFileSync(this.path, "utf-8"));
        }
        else this.data = {};
        if (this.data.__version__ && this.data.__version__ !== version) this.data = {};
        this.newData = {
            "__version__": version
        };
    }

    has(filename: string) : boolean {
        const entry = this.data[filename];
        try {
            const stats = fs.statSync(filename);
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