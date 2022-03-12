import { Project } from "@ts-docs/extractor";
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
    data: Array<[
        moduleId: number, // Module ID,
        classes: Array<[name: string, properties: Array<[string, number, SearchDataComment]>, methods: Array<[string, number, SearchDataComment]>, path: Array<number>, comment: SearchDataComment]>, // Classes
        interfaces: Array<[name: string, fields: Array<string>, path: Array<number>, comment: SearchDataComment]>, // Interfaces,
        enums: Array<[name: string, members: Array<string>, path: Array<number>, comment: SearchDataComment]>, // Enums,
        types: Array<[name: string, path: Array<number>]>, // Types
        functions: Array<[name: string, path: Array<number>]>, // Functions
        constants: Array<[name: string, path: Array<number>]> // Constants
    ]>,
    moduleNames: Array<string> // Module names
];

/**
     * Packs the data in a convinient, small format. Unlike the default strucutre provided by ts-extractor, this packed structure only registers the "global"
     * modules and includes all of the sub-module's things (classes, interfaces, etc.). 
     * 
     * Writes [[PackedSearchData]] to the provided path.
     * 
*/
    
export function packSearchData(extractors: Array<Project>, path: string) : void {
    const res = [[], []] as PackedSearchData;
    for (const extractor of extractors) {
        const modObj = [0,[],[],[],[],[],[]] as PackedSearchData[0][0]; 
        extractor.forEachModule((mod) => {
            const path = mod.path;
            modObj[0] = res[1].push(mod.name) - 1;
            const numPath = path.map(pathName => res[1].indexOf(pathName));
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            for (const cl of mod.classes) modObj[1].push([`${cl.name}${cl.id ? `_${cl.id}`:""}`, cl.properties.filter(p => p.prop).map(p => [p.prop!.rawName, buildBitfield(p.isPrivate && ClassMemberFlags.IS_PRIVATE), getComment(p)]), cl.methods.map(p => [p.rawName, buildBitfield(p.isGetter && ClassMemberFlags.IS_GETTER, p.isSetter && ClassMemberFlags.IS_SETTER, p.isPrivate && ClassMemberFlags.IS_PRIVATE), getComment(p)]), numPath, getComment(cl)]);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            for (const intf of mod.interfaces) modObj[2].push([`${intf.name}${intf.id ? `_${intf.id}`:""}`, intf.properties.filter(p => p.prop).map(p => p.prop!.rawName), numPath, getComment(intf)]);
            for (const en of mod.enums) modObj[3].push([`${en.name}${en.id ? `_${en.id}`:""}`, en.members.map(m => m.name), numPath, getComment(en)]);
            for (const typ of mod.types) modObj[4].push([`${typ.name}${typ.id ? `_${typ.id}`:""}`, numPath]);
            for (const fn of mod.functions) modObj[5].push([`${fn.name}${fn.id ? `_${fn.id}`:""}`, numPath]);
            for (const constant of mod.constants) modObj[6].push([`${constant.name}${constant.id ? `_${constant.id}`:""}`, numPath]);
        });
        res[0].push(modObj);
    }
    fs.writeFileSync(path, JSON.stringify(res));
}