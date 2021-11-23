# ts-docs

[![Codacy Badge](https://api.codacy.com/project/badge/Grade/1ad389cd1f3f4a848bf8b47898b53388)](https://app.codacy.com/gh/ts-docs/ts-docs?utm_source=github.com&utm_medium=referral&utm_content=ts-docs/ts-docs&utm_campaign=Badge_Grade_Settings)

An opinionated documentation generator for typescript - generate informative and accurate documentation sites with zero setup.

If you want to check out how a typical ts-docs documentation looks like, head over to the official docs, found [here](https://ts-docs.github.io/ts-docs/index.html).

## Installation

**Important:** You need typescript 4.3+ in order to use ts-docs!

```
npm i --save-dev @ts-docs/ts-docs @ts-docs/default-docs-structure 
```

## Usage 

In order for ts-docs to generate proper documentation, you need to give it one or multiple "project entry points". **Every entry point should point to a different project**. You can find out more information about all the options ts-docs has [here](https://ts-docs.github.io/ts-docs/pages/Guides/Options.html).

Simple usage which uses the default options:
```
ts-docs src/index.ts
```

## Features

- Documentation structure akin to [docs-rs](https://docs.rs/) and rust in general, every folder inside the project is a different module. 
- Document multiple projects, monorepo support out of the box.
- Slick design, dark/light theme, powerful search and filter function.
- Link external references to their respective documentation.
- Out of the box branches documentation, generate documentation for multiple branches.
- Changelog generation, pulled from github releases.
- Built-in custom pages support. Host your guides and tutorials right inside the documentation.
- 100% accurate, you won't find missing references unless they're external.

**This documentation generator may not work on your project at all, although most typescript projects follow the structure the generator supports.**

## Examples

<details>
<summary>ts-docs</summary>
<img src="https://i.imgur.com/8FpQb1F.png">
</details>

<details>
<summary>detritus</summary>
<img src="https://i.imgur.com/yBtBsg4.png">
</details>


## Contributing

Contributions are appreciated, feel free to open an issue or a pull request [here](https://github.com/ts-docs/ts-docs).

Make sure to read the [contribution guide](https://github.com/ts-docs/ts-docs/blob/main/.github/CONTRIBUTING.md)