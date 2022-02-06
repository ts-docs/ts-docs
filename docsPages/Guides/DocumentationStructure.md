---
name: Custom Styling
order: 6
---

# Custom styling

If you want to change how your documentation site looks, you can create a custom **documentation structure**. It's is similar to a theme, but way more flexible. It allows you to change the functionality of the page. The documentation structure does all the work to make the site look like how it does. It exposes functions which take in data, and return valid HTML, the generator just calls those functions. If you want to see an example of a structure, check out the [default one](https://github.com/ts-docs/default-docs-structure).

You can check out all the functions the structure should export [[Components as here]]. All functions take in the [[Generator]] as a first parameter, and then an object which includes data
specific to the function. 

## HTML strings

Since all the functions must return a string which contains HTML, it's a good idea to use **a html render engine**. Some examples of rendering engines are `handlebars`, `eta`, `ejs` and `pug`.
You can use them, but I recommend using [jsx-to-str](https://github.com/ts-docs/jsx-to-str): A typescript plugin which turns JSX to string literals. This makes your structure lighter, and also has a lot of other benefits, like working IntelliSense out of the box, typesafety and nice error messages.

## `init` function

Your documentation generator must export an `init` function, which returns all of the other functions in an object. You can do anything inside that function, for example, the default structure
puts all functions in different files, and the init function uses the `fs` module to get all functions. 

## SPAs?

Since HTML strings must be returned, you cannot create a single page application using a custom documentation structure. You have other options, though. You can:

- Create your own generator using ts-docs' own [extractor](https://github.com/ts-docs/ts-extractor).
- Or, use `ts-docs` with the `json` option, which will give you all the data you need in a json file. From there you can use that data to create your SPA.

