# Contributing

## How you can contribute

The entire ts-docs codebase is split in 3 different repositories:

- [ts-docs](https://github.com/ts-docs/ts-docs) - Main repository, all issues, bugs and suggestions go here.
- [ts-extractor](https://github.com/ts-docs/ts-extractor) - Extracts data from typescript files.
- [default-docs-structure](https://github.com/ts-docs/default-docs-structure) - Responsible for generation of HTML strings, styling and all client-side functionalities.

### Making a pull request

If you'd like to help out and contribute to add in a suggestion, or fix a bug, make sure to first create an issue **in the main repository** (if one doesn't exist). Depending on the context of the issue, you'll have to fork one of the three repositories above. When a PR's been created, make sure to link it to the issue in a comment: `repo#pr-id`.

### Bug reports

When you think you might've experienced a bug, first search through the [issues](https://github.com/ts-docs/ts-docs/issues) to see if it has already been reported, if it hasn't, feel free to create an [issue](https://github.com/ts-docs/ts-docs/issues) which describes the bug in detail. Do not be afraid to give as much information as possible, and make sure to provide an example which replicates the bug in question.

- Make sure the name of your issue is clear and descriptive, avoid one-word issue names.
- Add the options you ran ts-docs with.

### Suggestions

If you have a suggestion, feel free to create an [issue](https://github.com/ts-docs/ts-docs/issues) describing the suggestion and the problems / issues it'll 
resolve. 

Suggestions which completely change the structure of the generated docs will be declined. If you would like a different structure, consider using [ts-extractor](https://github.com/ts-docs/ts-extractor) and generate the documentation yourself, or use an alternative to ts-docs, such as [typedoc](https://typedoc.org/).
