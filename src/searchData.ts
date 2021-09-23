import { Project, Property } from "@ts-docs/extractor";
import fs from "fs";

/**
 * Used for the [[packSearchData]] function.
 */
export const enum ClassMemberFlags {
    IS_GETTER = 1 << 0,
    IS_SETTER = 1 << 1,
    IS_PRIVATE = 1 << 2
}

/**
 * Adds the provided bits.
 */
export function buildBitfield(...bits: Array<number|undefined|false>) : number {
    return (bits.filter(bit => bit) as Array<number>).reduce((acc, bit) => acc | bit, 0);
}

/**
     * Packs the data in a convinient, small format. Unlike the default strucutre provided by ts-extractor, this packed structure only registers the "global"
     * modules and includes all of the sub-module's things (classes, interfaces, etc.).
     * 
     * Returns an [[Array]] which looks something like this:    
     * `[globalModules, allModuleNames];`
     * 
     * globalModules is an [[Array]] of module objects, which look like this:   
     * `[nameIndex, classes, interfaces, enums, types, functions, constants]`
     * 
     * a **class**: `[name, properties, methods, path]`  
     * a **method**: `[name, flags]`      
     * a **property**: `[name, flags]`       
     * an **inteface**: `[name, properties, path]`        
     * an **enum**: `[name, members, path]`       
     * a **type alias**: `[name, path]`       
     * a **function**: `[name, params, path]`     
     * a **constant**: `[name, path]`     
     *  
     * 
     * `flags` is a bitfield containing [[ClassMemberFlags]]    
     * `path` is an array of numbers, which are the indexes of the module names inside the `allModuleNames` array. Since module names repeat very often, they're all placed in one array (`allModuleNames`) to save space.
     * 
*/
    
export function packSearchData(extractors: Array<Project>, path: string) : void {
    const res = [[], []] as [Array<unknown>, Array<string>];
    const notSingleExtractor = extractors.length !== 1;
    for (const extractor of extractors) {
        const modObj = [0,[],[],[],[],[],[]] as [number, Array<[string, Array<[string, number]>, Array<[string, number]>, Array<number>]>, Array<[string, Array<string>, Array<number>]>, Array<[string, Array<string>, Array<number>]>, Array<[string, Array<number>]>, Array<[string, Array<number>]>, Array<[string, Array<number>]>]; 
        extractor.forEachModule(extractor.module, (mod, path) => {
            modObj[0] = res[1].push(mod.name) - 1;
            let p;
            if (notSingleExtractor) p = [res[1].indexOf(extractor.module.name), ...path.map(pathName => res[1].indexOf(pathName))];
            else p = path.map(pathName => res[1].indexOf(pathName));
            for (const cl of mod.classes) modObj[1].push([cl.name, cl.properties.map(p => [p.name, buildBitfield(p.isPrivate && ClassMemberFlags.IS_PRIVATE)]), cl.methods.map(p => [p.name, buildBitfield(p.isGetter && ClassMemberFlags.IS_GETTER, p.isSetter && ClassMemberFlags.IS_SETTER, p.isPrivate && ClassMemberFlags.IS_PRIVATE)]), p]);
            for (const intf of mod.interfaces) modObj[2].push([intf.name, intf.properties.filter(p => !("key" in p.value)).map(p => (p.value as Property).name), p]);
            for (const en of mod.enums) modObj[3].push([en.name, en.members.map(m => m.name), p]);
            for (const typ of mod.types) modObj[4].push([typ.name, p]);
            for (const fn of mod.functions) modObj[5].push([fn.name, p]);
            for (const constant of mod.constants) modObj[6].push([constant.name, p]);
        });
        res[0].push(modObj);
    }
    fs.writeFileSync(path, JSON.stringify(res));
}