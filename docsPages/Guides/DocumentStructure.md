---
name: Documentation Structure
order: 4
---

# Custom documentation structure

This guide will go over the tiny details and gotchas of creating a custom documentation structure. If you want to learn more about what a documentation structure is and it's components, head over to the [[DocumentStructure]] interface.

See also [[DocumentStructureData]], which documents some of the things ts-docs provides to the documentation structure.

## CSS classes

ts-docs expects the following CSS classes to be defined by the documentation structure:

- `text-block`, `text-block-warning`, `text-block-note`, `text-block-success` - used for the markdown text blocks.
- `section-header` - used for headers which were defined in **markdown**, by the author, not the documentation.

### Depth-mess

Due to how the documentation generator structures the docs, links can get a little... messy. The `depth` property specifies how "deep" the current item is from the **root of the documentation**. 


