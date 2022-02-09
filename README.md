
<p align="center">
  <img src="https://github.com/ts-docs/ts-docs/blob/main/assets/logo.png?raw=true" width="200px" />
</p>

# ts-docs

[![GitHub license](https://img.shields.io/github/license/ts-docs/ts-docs?style=flat-square)](https://github.com/ts-docs/ts-docs/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/ts-docs/ts-docs?style=flat-square)](https://github.com/ts-docs/ts-docs/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/ts-docs/ts-docs?style=flat-square)](https://github.com/ts-docs/ts-docs/issues)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/639fba225a094e769b4c8976a30bf7c1)](https://www.codacy.com/gh/ts-docs/ts-docs/dashboard?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=ts-docs/ts-docs&amp;utm_campaign=Badge_Grade)

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
- Out of the box documentation generation for different branches of your repository.
- Changelog generation, pulled from github releases.
- Built-in custom pages support. Host your guides and tutorials right inside the documentation.
- 100% accurate, you won't find missing references unless they're external.
- Unit tests inside documentation comments.

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

Make sure to read the [contribution guide](https://github.com/ts-docs/ts-docs/blob/main/.github/CONTRIBUTING.md).