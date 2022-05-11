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
}
```
```js --tsdocs.config.js
module.exports = {
    entryPoints: ["./entry/point.js"],
    docTests: true
}
```

|> ts-docs relies on the code already being transpiled, so make sure you transpile your project's code before running ts-docs with this option enabled: `tsc && ts-docs`.

|> Only code that is inside a documentation comment for a class **method** / **constructor**, or a **function** will be executed.

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

## Suites

Documentation tests are grouped into **suites**. All documentation tests which belong to a single class are put in the same suite, and all functions inside a module are put in the same suite. Each suite runs on a different thread.

## Imports

By default, the class / function that the test is for is automatically imported. If you need anything else in the test, you can import it. If the item being tested is exported via `export default`, then you need to import it as well.

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

## Async/await

You can use top-level async / await in your examples. 

```ts
/**
 * const value = await asyncFn(15);
 * assert(value === 15);
 */
export function asyncFn(num: number) {
    return Promise.resolve(num);
}
```

## Excluding code blocks

You can make it so certain code blocks don't get executed by providing the language `notest`. This won't run the example, and the code will be highlighted as typescript.

```ts
/**
 * ```notest
 *  // Your ts code here...
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

## `docTests` with `forceEmit`

If the `forceEmit` option is **not** enabled, ts-docs will not run any doc tests inside unchanged files. This can become a problem if any of your tests uses `import`, so it's a good idea to always run tests with the `forceEmit` option turned on.

## Running untrusted tests

The tests are **not** ran in a VM - they are quite literally `eval`ed, so make sure you trust the library before generating docs for it with the `docTests` option turned on!