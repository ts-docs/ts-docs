---
name: Custom Pages
order: 3
---

# Custom pages

One unique feature of ts-docs is that it allows you to create custom pages directly in the documentation! Custom pages only appear at the landing page in the sidebar, and when in a custom page.

## Setup

In order to use custom pages, you must give the `customPages` setting a path to a directory which contains **custom pages categories**, which are basically a folder with markdown files inside it. 

For example, this is how the custom pages structure looks for this site:

```
- docsPages
    - Guides
        - CustomMarkdown.md
        - CustomPages.md
        - Options.md
```

## Front Matter

You can also start each custom page file with a metadata header (called front matter) where you can provide some useful metadata for the generator. Possible fields:

```md
---
name: Page Name
order: 5
---

# Markdown content here...
```

- `name` - The name of the page. If not provided, the file name will be used.     
- `order` - Where the page will be placed.

