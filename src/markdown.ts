
import highlight from "highlight.js";
import marked from "marked";

export function initMarkdown() : void {
    marked.use({
        renderer: {
            code: (code, lang) : string => {
                return `
                <pre>
<code class="hljs">
${highlight.highlight(code, {language: lang || "js"}).value}
</code>
                </pre>
                `;
            }
        },
    });

}