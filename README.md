# ts-docs

An opinionated documentation generator for typescript - generate beautiful and simplistic documentation. 

If you want to check out how a typical ts-docs documentation looks like, head over to the official docs, found [here](https://ts-docs.github.io/ts-docs/index.html)

## Installation

**This project is not yet released. Currently you cannot use npm to install it**

```
npm i @ts-docs/ts-docs @ts-docs/default-docs-structure
```

## Usage 

In order for ts-docs to generate proper documentation, you need to give it one or multiple entry points to your project.

In ts-docs, an entry point means something else: If your project is not a monorepo, you should ideally have only one entry point. If you have multiple repositories in your project (like this one!) you can have one entry point for each repository. 

You can find out about the options ts-docs has [here](https://ts-docs.github.io/ts-docs/pages/Guides/Options.html)

Simple usage which uses the default options:

```
ts-docs src/index.ts
```
