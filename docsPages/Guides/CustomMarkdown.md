---
name: Custom Markdown
order: 2
---

# Custom Markdown

You can use custom ts-docs markdown syntax in order to make your documentation more informative and prettier. You can use this syntax in custom pages and in jsdoc comments.

## Linking assets

If you want to have an image which comes from the `assets` folder, simply start the link of the image with `./assets` or `assets`. 

Example:
```markdown
[cute_kitty](./assets/images/cute_kitty.png)
```

## Warning blocks

Warning blocks can be used to outline an important piece of information.

|> This is a warning!

Example:
```markdown
|> This is a warning!
```

## References

You can reference classes, interfaces, enums, type aliases, methods, properties, functions, constants and namespaces by putting their name inside double square brackets, for example:

`[[Generator]]` becomes [[Generator]]

### Methods and properties

You can reference a property by adding a dot (`.`) and then the name of the property. 

`[[Generator.structure]]` becomes [[Generator.structure]]

You can reference a method by adding a dot (`.`), the method's name, and then `()` at the end.

`[[Generator.generate()]]` becomes [[Generator.generate()]]

### By path

ts-docs searches each module in order to find the name of the references, this could lead to inaccurate links, so you always can just provide the entire path to the thing.

`[[extractor/extractor/ExtractorList]]` becomes [[extractor/extractor/ExtractorList]]

### Name aliases

You can also follow up a normal reference or a reference by path with `as ...` to change the text that gets displayed.

`[[Generator as TsDocsGenerator]]` becomes [[Generator as TsDocsGenerator]]

## Supported JSDoc tags

### `@link`

ts-docs supports the `@link` / `@linkplain` JSDoc tag, except it doesn't support properties / methods, name aliases and paths. It's not recommended to use `{@link}` in custom pages and documentation comments, in this case it exists only for compatibility reasons.

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

