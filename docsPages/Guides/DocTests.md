---
name: Documentation Tests
order: 5
---

# Documentation tests

`ts-docs` allows you to test typescript or javascript code inside documentation comments. This assures that the code inside documentation comments is up to date, and 100% correct. You can also use this feature to write **unit tests**.

To enable documentation tests, set the `docTests` option to true:

``` --CLI
ts-docs ./src/index.ts --docTests
```
```json --tsconfig.json
"tsdocsOptions": {
    "entryPoints": ["./entry/point.js"],
    "docTests": true
```
```js --tsdocs.config.js
module.exports = {
    entryPoints: ["./entry/point.js"],
    docTests: true
}
```

|> Important! Only code that is inside a documentation comment for a class **method** / **constructor**, or a **function** will be executed.

Turning this single option on will cause all your typescript / javascript codeblocks inside comments to be executed.

```ts
export class SomeClass {
    /**
     * @example
     * ```ts
     * const client = new SomeClass();
     * assert(client.doSomething() === 42)
     * ```
     */
    doSomething() : number {
        return 42;
    }
}
```

## Passing or failing

Documentation tests are considered to pass when they transpile and run without any errors. If any of the code errors, ts-docs will still generate the documentation, but it'll let you know where the error occured. The [assert](https://nodejs.org/api/assert.html) family of functions is imported by default, you can use them to demonstrate what the method / function should return.

```ts
const val = "value";
assert.equal(val, "foo", "Value must be equal to 'foo'");
```

## Imports

By default, the class / function that the test is for is automatically imported as well. If you need anything else in the test, you can import it.

|> If you want to import something, you **must** use the `import` syntax. Using `require` won't work.

```ts
/**
 * ```ts
 * import { someOtherFn } from "./someOtherFn";
 * assert(someFn() === someOtherFn())
 * ```
 */
export function someFn() {
    //...
}
```

## Excluding code blocks

You can make it so certain code blocks don't get executed by providing the language `notest`. This won't run the example, and the code will be highlighted as typescript.

```ts
/**
 * ```notest
 *  // Your test code here...
 * ```
 */
```

## Excluding parts of the code

Sometimes you may need setup code for a particular test or example, which you don't want the end user to see. You can prefix any line with `#`, that will cause the line to be removed from the rendered documentation, but still get transpiled and ran:

```ts
/**
 * ```ts
 *  # import { setup } from "../setupFns";
 *  # setup();
 *  assert(someFn() === true);
 * ```
 */
```

This will appear like so in the documentation:

```ts
assert(someFn() === true);
```

You can prevent this from happening by using two consecutive hashes: `##`:

```ts
const code = `
## Title
`
```

This will render like so:

```ts
const code = `
# Title
`
```