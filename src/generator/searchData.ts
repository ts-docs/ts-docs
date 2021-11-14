import { ClassProperty, Project } from "@ts-docs/extractor";
import fs from "fs";
import { getComment } from "../utils";

/**
 * Used for the [[packSearchData]] function.
 */
export const enum ClassMemberFlags {
    IS_GETTER = 1 << 0,
    IS_SETTER = 1 << 1,
    IS_PRIVATE = 1 << 2
}


function buildBitfield(...bits: Array<number|undefined|false>) : number {
    return (bits.filter(bit => bit) as Array<number>).reduce((acc, bit) => acc | bit, 0);
}

export type SearchDataComment = string|undefined;

export type PackedSearchData = [
    Array<[
        number, // Module ID,
        Array<[string, Array<[string, number, SearchDataComment]>, Array<[string, number, SearchDataComment]>, Array<number>, SearchDataComment]>, // Classes
        Array<[string, Array<string>, Array<number>, SearchDataComment]>, // Interfaces,
        Array<[string, Array<string>, Array<number>, SearchDataComment]>, // Enums,
        Array<[string, Array<number>]>, // Types
        Array<[string, Array<number>]>, // Functions
        Array<[string, Array<number>]> // Constants
    ]>,
    Array<string> // Module names
];

/**
     * Packs the data in a convinient, small format. Unlike the default strucutre provided by ts-extractor, this packed structure only registers the "global"
     * modules and includes all of the sub-module's things (classes, interfaces, etc.).
     * 
     * Returns an array which looks something like this:    
     * `[globalModules, allModuleNames];`
     * 
     * globalModules is an [[Array]] of module objects, which look like this:   
     * `[nameIndex, classes, interfaces, enums, types, functions, constants]`
     * 
     * a **class**: `[name, properties, methods, path, comment?]`  
     * a **method**: `[name, flags, comment?]`      
     * a **property**: `[name, flags, comment?]`       
     * an **inteface**: `[name, properties, path, comment?]`        
     * an **enum**: `[name, members, path, comment?]`       
     * a **type alias**: `[name, path]`       
     * a **function**: `[name, path]`     
     * a **constant**: `[name, path]`     
     *  
     * 
     * `flags` is a bitfield containing [[ClassMemberFlags]]    
     * `path` is an array of numbers, which are the indexes of the module names inside the `allModuleNames` array. Since module names repeat very often, they're all placed in one array (`allModuleNames`) to save space.
     * 
     * Also check out [[PackedSearchData]]
     * 
*/
    
export function packSearchData(extractors: Array<Project>, path: string) : void {
    const res = [[], []] as PackedSearchData;
    const notSingleExtractor = extractors.length !== 1;
    for (const extractor of extractors) {
        const modObj = [0,[],[],[],[],[],[]] as PackedSearchData[0][0]; 
        extractor.forEachModule(extractor.module, (mod, path) => {
            modObj[0] = res[1].push(mod.name) - 1;
            const numPath = path.map(pathName => res[1].indexOf(pathName));
            for (const cl of mod.classes) modObj[1].push([`${cl.name}${cl.id ? `_${cl.id}`:""}`, cl.properties.filter(p => p.prop).map(p => [p.prop!.rawName, buildBitfield(p.isPrivate && ClassMemberFlags.IS_PRIVATE), getComment(p)]), cl.methods.map(p => [p.rawName, buildBitfield(p.isGetter && ClassMemberFlags.IS_GETTER, p.isSetter && ClassMemberFlags.IS_SETTER, p.isPrivate && ClassMemberFlags.IS_PRIVATE), getComment(p)]), numPath, getComment(cl)]);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            for (const intf of mod.interfaces) modObj[2].push([`${intf.name}${intf.id ? `_${intf.id}`:""}`, intf.properties.filter(p => p.prop).map(p => p.prop!.rawName), numPath, getComment(intf)]);
            for (const en of mod.enums) modObj[3].push([`${en.name}${en.id ? `_${en.id}`:""}`, en.members.map(m => m.name), numPath, getComment(en)]);
            for (const typ of mod.types) modObj[4].push([`${typ.name}${typ.id ? `_${typ.id}`:""}`, numPath]);
            for (const fn of mod.functions) modObj[5].push([`${fn.name}${fn.id ? `_${fn.id}`:""}`, numPath]);
            for (const constant of mod.constants) modObj[6].push([`${constant.name}${constant.id ? `_${constant.id}`:""}`, numPath]);
        }, notSingleExtractor ? [extractor.module.name] : []);
        res[0].push(modObj);
    }
    fs.writeFileSync(path, JSON.stringify(res));
}