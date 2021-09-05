---
name: External Libs
order: 4
---

# External Libs

External libraries are third-party libraries which your project uses. You generally don't want to generate documentation for external libraries, so any types provided by them won't be linked in the documentation. You can use the `externalLibs` option to link external types while not generating any documentation for them at the same time.

In order to use the `externalLibs` option, you need to create a `tsDocs.config.js` file in the root directory of your project. From there, you have to export an array with [[ExternalLib]] objects.

```js
module.exports = {
    externalLibs: [
        {
            name: "name of the library you want to link types for",
            resolver: (referenceName, path, symbol, kind) => {
                // This function needs to return the link to the reference
                return `https://other-docs.com/type/${referenceName}.html`;
            }
        }
    ]
}
```

And that's it!
