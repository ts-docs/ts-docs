import * as ts from "typescript";

/**
 * An item path is the module path to which an item definition
 * can be found.
 * 
 * The path array does **not** include the name of the item the path
 * belongs to, only the names of the modules it takes to get to the
 * item, with the last module being the module the item's in.
 */
export type ItemPath = string[];

export interface ProjectMetadata {
    packageJSON: Record<string, string>,
    tsconfig: ts.CompilerOptions
}

/**
 * A `module` in ts-extractor is defined as a **directory** which
 * contains code. This code could be isolated from the rest of the
 * modules or have dependencies from other modules.
 * 
 * A module exposes all **exported** items defined in it's files, which include
 * classes, interfaces, enums, functions and constants.
 * 
 * If there are more directories inside of the module, they become **sub-modules**.
 * Sub-modules are treated as normal modules, just nested. If a module exports items
 * which are part of a sub-module, they do **not** become part of the module, instead
 * the references they get put in the [[exports]] object.
 * 
 * Namespaces are also modules. If that's the case, the [[namespace]] property
 * will be filled with details about the namespace (file name(s), locations)
 */
export interface Module {
    name: string,
    modules: Map<string, Module>,
    baseDir: string,
    path: ItemPath,
    ref: TypeReference,
    namespace?: LoC[]
}

export interface JSDocTag {
    name: string,
    comment?: string,
    arg?: string,
    type?: Type
}

export interface JSDocData {
    tags?: JSDocTag[],
    comment?: string
}

export interface LoC {
    pos: ts.LineAndCharacter,
    /**
     * Does not include the module's baseDir
     */
    sourceFile: string
}

export enum TypeKind {
    Reference,
    ObjectLiteral,
    Tuple,
    Union,
    Array,
    Number,
    String,
    Boolean,
    Void,
    True,
    False,
    Undefiend,
    Null,
    Any,
    Mapped,
    Conditional,
    TemplateLiteral,
    IndexAccess,
    This,
    Never,
    Object,
    Infer,
    TypeofOperator,
    UniqueOperator,
    ReadonlyOperator,
    KeyofOperator,
}

export enum TypeReferenceKind {
    Class,
    Interface,
    Function,
    Enum,
    Constant,
    TypeAlias,
    TypeParameter,
    EnumMember,
    Module,
    Default,
    External
}

/**
 * Nodes are the objects which create types. For example: class declarations,
 * interface declarations, type aliases, etc.
 */
export interface Node {
    name: string,
    loc: LoC,
    jsDoc?: JSDocData,
    otherDefs?: LoC[]
}

export interface BaseType {
    kind: TypeKind
}

/**
 * If the object's [[ReferenceType.link]] property is not undefined, then that means it's an **external**
 * object. The [[ReferenceType.external]] property will be set to the external library's name.
 * 
 * [[ReferenceType.displayName]] is only present when the referenced item is an **enum member**. The
 * property will be set to the member's name, while the **name** property will be set to the enum name.
 */
export interface TypeReference {
    name: string,
    kind: TypeReferenceKind,
    displayName?: string,
    path?: ItemPath,
    externalLibName?: string,
    link?: string
}

export interface Reference extends BaseType {
    type: TypeReference,
    typeArguments?: Type[]
}

/**
 * Types are either references to nodes, or use nodes in some way.
 */
export type Type = Reference;