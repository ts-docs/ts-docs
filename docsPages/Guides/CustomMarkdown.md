---
name: Custom Markdown
order: 2
---

# Custom markdown

You can use custom ts-docs markdown syntax in order to make your documentation more informative and prettier. You can use this syntax in custom pages and in jsdoc comments.

## References in codeblocks

If the language inside the codeblock is typescript or javascript, ts-docs will try to link every reference used in the code.

```ts
import { Generator } from "ts-docs";


const gen = new Generator({...});
gen.generate();
```

## Code tabs

Use this if you want to provide code snippets in multiple languages, formats, styles, etc. 

````markdown
```ts --Typescript
function add(a: number, b: number) : number {
    return a + b;
}
```
```rs --Rust
fn add(a: i32, b: i32) -> i32 {
    a + b
}
```
````

Becomes:

```ts --Typescript
function add(a: number, b: number) : number {
    return a + b;
}
```
```rs --Rust
fn add(a: i32, b: i32) -> i32 {
    a + b
}
```

## Linking assets

If you want to have an image which comes from the `assets` folder, simply start the link of the image with `./assets` or `assets`. 

Example:
```markdown
[cute_kitty](./assets/images/cute_kitty.png)
```

## Text blocks

You can create warning, note or success text blocks with the following syntax:

|> This is a warning!

Example:
```markdown
|> This is a warning!
```
By default the text block is styled as a warning.

|>[note] This is a note!

Example:
```markdown
|>[note] This is a note!
```

|>[success] This is a success block!

Example:
```markdown
|>[success] This is a success block!
```

The style specifier (`[note|warning|success]`) must be RIGHT after the text block start.

## References

You can reference classes, interfaces, enums, type aliases, methods, properties, functions, constants, namespaces and modules by putting their name inside double square brackets, for example:

`[[Generator]]` becomes [[Generator]]

### Methods and properties

You can reference a property by adding a dot (`.`) and then the name of the property. 

`[[Generator.structure]]` becomes [[Generator.structure]]

You can reference a method by adding a dot (`.`), the method's name, and then `()` at the end.

`[[Generator.generate()]]` becomes [[Generator.generate()]]

If the method or property is inside the class you're currently writing documentation for, you can just provide their names, and ts-docs will figure out
if it's a property or a method, and properly link it:

`[[generate]]` becomes [[Generator.generate()]]

### By path

ts-docs searches each module in order to find the name of the references, this could lead to inaccurate links, so you always can just provide the entire path to the item.

`[[extractor/extractor/TypescriptExtractor]]` becomes [[extractor/extractor/TypescriptExtractor]]

### Name aliases

You can also follow up a normal reference or a reference by path with `as ...` or `| ...` to change the text that gets displayed.

`[[Generator as TsDocsGenerator]]` becomes [[Generator as TsDocsGenerator]]

`[[ts-docs | the documentation generator]]` becomes [[ts-docs | the documentation generator]]

### By type

Let's say you have a class with the name `ABC`, and an interface with the same name, and both of the declarations are inside the same module. If you were to search for it either by name or by path, always the item declared first will show. To prevent this, you can prefix the name with `:<type>` to only search for items of the specified type and name. 

`[[Generator:class]]` becomes [[Generator:class]]

Available types are: `class`, `interface`, `enum`, `function`, `constant`, `type`, `module`.

## Supported JSDoc tags

### `@link` / `@linkplain` / `@linkcode`

Work exactly the same as using the square bracket syntax `[[]]`. Currently, `@linkplain` and `@linkcode` do **not** change the style of the reference.

### `@param`

Documents a method / function parameter, the parameter type WILL NOT be used by ts-docs. 

```ts
/**
 * @param a Parameter description... 
 *
*/
function doSomething(a: string) : void {
    // Code...
}
```

### `@example`

Documents an example.

```ts
/**
 * @example
 * 
 * ```ts
 * const myApple = new Apple("Ambrosia");
 * myApple.eat();
 * ```
 * 
*/

class Apple {
    kind: string
    constructor(kind: string) {
        this.kind = kind;
    }
}
```

### `@deprecated`

Any property or method with that tag will have a red "deprecated" tag, letting readers know that the method shouldn't be used.

### `@returns`

Documents information about the return value of a method. You can provide a type here, in case ts-docs isn't able to find it. 

### `@internal`

Omit an item from the documentation. This tag works for the following items:

- classes
    - class members (methods, properties, getters, setters)
- interfaces
    - interface members
- enums
    - enum members
- functions
- type aliases
- constants

**It doesn't work for namespaces.**

You also have to enable the `stripInternal` option.

### `@since`

Adds a `since` tag to the item that has the tag, along with a version name.

Example:

```js
/**
 * @since 1.0.1 
*/
function example() {
    //...
} 
```

### `@beta`

Adds a `beta` tag next to the item that has the tag.

### `@alpha`

Adds an `alpha` tag next to the item.

### `@remarks`

### `@throws`

Use this if your method / function has the potential to throw, and provide examples of how and when.

### `@experimental`

Adds an `experimental` tag next to the item.
