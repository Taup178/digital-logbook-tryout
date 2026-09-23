/* Mermaid loader (Material for MkDocs recommended approach): mkdocs.yml
 * renders ```mermaid blocks as <pre class="mermaid">, this loads the
 * library as an ES module and renders them. */
import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs').then((m) => {
  m.default.initialize({ startOnLoad: true });
});
