import ts from "typescript";
import { BitField } from "./utils";

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
    classes: ClassDeclaration[],
    interfaces: InterfaceDeclaration[],
    types: TypeAliasDeclaration[],
    enums: EnumDeclaration[],
    baseDir: string,
    path: ItemPath,
    /**
     * The path of every child inside the module.
     */
    childrenPath: ItemPath,
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
    comment: string[]
}

export interface LoC {
    pos: ts.LineAndCharacter,
    /**
     * Does not include the module's baseDir. It only exists
     * when the LoC is for a type definition (class, interface, etc.)
     */
    sourceFile?: string
}

export enum TypeKind {
    Reference,
    ObjectLiteral,
    ArrowFunction,
    Tuple,
    Union,
    Intersection,
    Array,
    Number,
    String,
    Boolean,
    Void,
    Undefined,
    Null,
    Any,
    Unknown,
    Mapped,
    Conditional,
    TemplateLiteral,
    IndexAccess,
    TypeOperator,
    Never
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
    StringUtility,
    Unknown
}

export enum DeclarationKind {
    Class,
    Interface,
    Enum,
    Function,
    Constant,
    TypeAlias
}

export type BaseNodeExtras = Record<string, unknown>;

export interface BaseNode {
    loc: LoC,
    jsDoc?: JSDocData,
    extras?: BaseNodeExtras
}

/**
 * Nodes are the objects which create types. For example: class declarations,
 * interface declarations, type aliases, etc.
 */
export interface Node extends BaseNode {
    name: string,
    id?: number,
    otherDefs?: LoC[]
}

/**
 * If the object's [[link]] property is not undefined, then that means it's an **external**
 * object. The [[externalLibName]] property will be set to the external library's name.
 * 
 * The [[parent]] property is only present when the referenced item is an **enum member**. The
 * property will be set to a reference to the enum itself.
 */
export interface TypeReference {
    name: string,
    kind: TypeReferenceKind,
    parent?: TypeReference,
    path?: ItemPath,
    externalLibName?: string,
    link?: string
}

export interface ReferenceType {
    kind: TypeKind.Reference,
    type: TypeReference,
    typeArguments?: Type[],
    /**
     * Only present if the [[TypeReferenceKind]] is a type parameter. If true, it means that
     * the type parameter in question comes with the `infer` keyword.
     */
    isInfer?: boolean
}

export enum PropertyFlags {
    Optional = 1 << 0,
    Readonly = 1 << 1,
    Exclamation = 1 << 2
}

export interface PropertySignature extends Node {
    name: string,
    flags: BitField,
    computed?: Type,
    type?: Type,
    initializer?: Type
}

export interface IndexSignature {
    key: "string" | "number",
    type: Type
}

export enum ElementParameterFlags {
    Optional = 1 << 0,
    Spread = 1 << 1
}

export interface FunctionParameter {
    name: string,
    flags: BitField,
    type?: Type,
    defaultValue?: Type,
    description?: string,
    jsDoc?: JSDocData
}

export interface TypeParameter {
    name: string,
    default?: Type,
    constraint?: Type
}

export interface BaseMethodSignature {
    returnType: Type,
    parameters: FunctionParameter[],
    typeParameters: TypeParameter[],
}

export interface MethodSignature extends BaseMethodSignature, BaseNode {
    isGenerator?: boolean
}

export enum MethodFlags {
    Async = 1 << 0,
    Generator = 1 << 1
}

export interface Method {
    name: string,
    computed?: Type,
    signatures: MethodSignature[],
    flags: BitField
}

export enum ClassMemberFlags {
    Private = 1 << 0,
    Static = 1 << 1,
    Protected = 1 << 2,
    Abstract = 1 << 3
}

export interface ClassMember {
    classFlags: BitField
}

export type ClassProperty = PropertySignature & ClassMember;
export type ClassMethod = Method & ClassMember;

export interface ObjectLiteral {
    properties: PropertySignature[],
    methods: Method[],
    indexes: IndexSignature[],
    new: Method[]
}

export type ClassObjectLiteral = Omit<ObjectLiteral, "properties"|"methods"> & {
    properties: ClassProperty[],
    methods: ClassMethod[]
}

export interface ClassDeclaration extends ClassObjectLiteral, Node {
    kind: DeclarationKind.Class,
    typeParameters: TypeParameter[],
    extends: Type[],
    implements: Type[],
    isAbstract?: boolean
}

export interface InterfaceDeclaration extends ObjectLiteral, Node {
    kind: DeclarationKind.Interface,
    typeParameters: TypeParameter[],
    extends: Type[],
    implements: Type[]
}

export interface EnumMember extends Node {
    /**
     * Type will only be present if [[initializer]] isn't.
     */
    type?: Type,
    initializer?: Type
}

export interface EnumDeclaration extends Node {
    kind: DeclarationKind.Enum,
    members: EnumMember[],
    isConst?: boolean
}

export interface TypeAliasDeclaration extends Node {
    kind: DeclarationKind.TypeAlias,
    value: Type,
    typeParameters: TypeParameter[],
}

export interface ConstantDeclaration extends Node {
    kind: DeclarationKind.Constant,
    type?: Type,
    content?: string
}

export type FunctionDeclaration = Method & Node;

export type Declaration = ClassDeclaration | InterfaceDeclaration | EnumDeclaration | TypeAliasDeclaration | ConstantDeclaration | FunctionDeclaration;

export interface ObjectLiteralType extends ObjectLiteral {
    kind: TypeKind.ObjectLiteral
}

export interface PrimitiveType {
    kind: TypeKind.String | TypeKind.Number | TypeKind.Boolean | TypeKind.Undefined | TypeKind.Null | TypeKind.Never | TypeKind.Any | TypeKind.Void | TypeKind.Unknown | TypeKind.Array,
    literal?: string
}

export interface UnionOrIntersectionType {
    kind: TypeKind.Union | TypeKind.Intersection,
    types: Type[]
}

export interface ConditionalType {
    kind: TypeKind.Conditional,
    checkType: Type,
    extendsType: Type,
    ifTrue: Type,
    ifFalse: Type
}

export interface ArrowFunctionType extends BaseMethodSignature {
    kind: TypeKind.ArrowFunction
}

export interface TypeOperator {
    kind: TypeKind.TypeOperator,
    operator: string,
    type: Type
}

/**
 * This type can only be seen on the [[TypeAliasDeclaration]] object.
 */
export interface MappedType {
    kind: TypeKind.Mapped,
    readonlyToken: "+" | "-",
    typeParameter: string,
    constraintType: Type,
    type: Type,
    nameType?: Type
}

export interface IndexAccessType {
    kind: TypeKind.IndexAccess,
    type: Type,
    index: Type
}

export interface TemplateLiteralType {
    kind: TypeKind.TemplateLiteral,
    text: string[],
    types: Type[]
}

export interface TupleElement {
    type: Type,
    flags: BitField,
    name?: string
}

export interface TupleType {
    kind: TypeKind.Tuple,
    types: TupleElement[]
}

/**
 * Types are either references to nodes, or use nodes in some way.
 */
export type Type = ReferenceType | ObjectLiteralType | PrimitiveType | UnionOrIntersectionType | ConditionalType | ArrowFunctionType | MappedType | IndexAccessType | TypeOperator | TemplateLiteralType | TupleType;

export const NEVER_TYPE: Type = { kind: TypeKind.Never };