---
name: Externals
order: 4
---

# External Libs

External libraries are third-party libraries which your project uses. You generally don't want to generate documentation for external libraries, so any types provided by them won't be linked in the documentation. You can use the `externals` option to link external types while not generating any documentation for them at the same time.

In order to use the `externals` option, you need to create a `tsdocs.config.js` file in the root directory of your project. From there, you have to export an array with [[ExternalReference]] objects.

```js
module.exports = {
    externals: [
        {
            baseName: "name of the library you want to link types for",
            run: (sym, path) => {
                // sym is a string
                // path is the path the reference was imported from
                switch(sym) {
                    case "...": return { link: `https://other-docs.com/type/${sym}.html` };
                }
            }
        }
    ]
}
```

And that's it!
