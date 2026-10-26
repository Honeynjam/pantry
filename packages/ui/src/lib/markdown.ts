import { Extension, Node, type AnyExtension, type Editor, type JSONContent } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";

/**
 * Markdown is the stored format (agents read and write it over MCP), so the editor must round-trip
 * it. Three layers make that hold:
 *
 * 1. Tiptap's own markdown support for what it can represent: headings, bold/italic/strike, inline
 *    code, code blocks, links, bullet/ordered/task lists, blockquotes, rules, hard breaks.
 * 2. Raw nodes for what it can't (tables, HTML blocks, link definitions, images): they keep the
 *    source text verbatim and write it back unchanged, instead of dropping it. Raw blocks are
 *    editable as plain text.
 * 3. `toMarkdown` restores the original text of every block the user didn't touch, so an edit to
 *    one paragraph never reformats the rest (`*` bullets, `__bold__`, setext headings, spacing).
 *    An untouched document comes back byte for byte.
 */

/** A block Tiptap can't represent, kept as its markdown source and shown as plain text. */
export const RawMarkdownBlock = Node.create({
  name: "rawMarkdownBlock",
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  defining: true,
  parseHTML() {
    return [{ tag: "pre[data-raw-markdown]", preserveWhitespace: "full" }];
  },
  renderHTML() {
    return [
      "pre",
      { "data-raw-markdown": "", class: "raw-markdown", title: "Markdown shown as written" },
      ["code", {}, 0],
    ];
  },
  renderMarkdown: (node) => (node.content ?? []).map((child) => child.text ?? "").join(""),
});

/** An inline construct Tiptap can't represent (images), kept verbatim as an atom. */
export const RawMarkdownInline = Node.create({
  name: "rawMarkdownInline",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { markdown: { default: "" } };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-raw-markdown-inline]",
        getAttrs: (element) => ({ markdown: (element as HTMLElement).textContent ?? "" }),
      },
    ];
  },
  renderHTML({ node }) {
    return ["span", { "data-raw-markdown-inline": "", class: "raw-markdown-inline" }, String(node.attrs.markdown)];
  },
  markdownTokenName: "image",
  parseMarkdown: (token) => ({ type: "rawMarkdownInline", attrs: { markdown: token.raw ?? "" } }),
  renderMarkdown: (node) => String(node.attrs?.markdown ?? ""),
});

const rawBlockText = (raw: string | undefined): JSONContent => {
  const text = (raw ?? "").replace(/\n+$/, "");
  return { type: "rawMarkdownBlock", content: text ? [{ type: "text", text }] : [] };
};

/** Routes one marked block token type to RawMarkdownBlock. */
const rawBlockFor = (tokenName: string) =>
  Extension.create({
    name: `rawMarkdownToken_${tokenName}`,
    markdownTokenName: tokenName,
    parseMarkdown: (token) => rawBlockText(token.raw),
  });

/** Block tokens marked produces that Tiptap would drop or flatten. */
const RAW_BLOCK_TOKENS = ["table", "html", "def"];

/** Every extension the editor uses, minus UI-only ones (placeholder, keymaps): also used headless in tests. */
export function markdownExtensions({ openLinksOnClick = false }: { openLinksOnClick?: boolean } = {}): AnyExtension[] {
  return [
    StarterKit.configure({
      // No markdown syntax for underline; keep the schema to what round-trips.
      underline: false,
      link: {
        openOnClick: openLinksOnClick,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    RawMarkdownBlock,
    RawMarkdownInline,
    ...RAW_BLOCK_TOKENS.map(rawBlockFor),
    Markdown.configure({ indentation: { style: "space", size: 2 } }),
  ];
}

type MarkdownManagerLike = NonNullable<Editor["markdown"]>;

type Block = { raw: string; isDefinition: boolean };

/** Top-level blocks of a markdown string, each as its source text without trailing newlines. */
function splitBlocks(manager: MarkdownManagerLike, markdown: string): Block[] {
  return manager.instance
    .lexer(markdown)
    .filter((token) => token.type !== "space")
    .map((token) => ({ raw: token.raw.replace(/^\n+|\n+$/g, ""), isDefinition: token.type === "def" }))
    .filter((block) => block.raw.trim().length > 0);
}

/** What Tiptap writes for a piece of markdown after loading it. */
function canonical(manager: MarkdownManagerLike, markdown: string): string {
  return manager.serialize(manager.parse(markdown)).replace(/\n+$/, "");
}

/**
 * The editor's markdown, with every block the user didn't change written exactly as it was in
 * `original`. Blocks are matched by what Tiptap would write for them, in order, so moved or
 * duplicated blocks still match.
 */
export function preserveUnchangedBlocks(manager: MarkdownManagerLike, original: string, next: string): string {
  const trimmedNext = next.replace(/\n+$/, "");
  if (!trimmedNext.trim()) return "";
  if (canonical(manager, original) === trimmedNext) return original;

  const originalBlocks = splitBlocks(manager, original);
  // Reference links (`[text][ref]`) only resolve next to their `[ref]: url` definitions, so each
  // block is read with the document's definitions after it, which are then cut off again.
  const definitions = originalBlocks.filter((block) => block.isDefinition).map((block) => block.raw);
  const context = definitions.length ? `\n\n${definitions.join("\n\n")}` : "";
  const canonicalInContext = (block: Block) => {
    if (!context || block.isDefinition) return canonical(manager, block.raw);
    const written = canonical(manager, block.raw + context);
    return written.endsWith(context) ? written.slice(0, -context.length) : canonical(manager, block.raw);
  };

  // Where each original block sits, so neighbours that both survive keep the text between them.
  let cursor = 0;
  const located = originalBlocks.map((block, index) => {
    const start = original.indexOf(block.raw, cursor);
    const end = start < 0 ? -1 : start + block.raw.length;
    if (end >= 0) cursor = end;
    return { ...block, index, start, end };
  });

  const pool = new Map<string, (typeof located)[number][]>();
  for (const block of located) {
    const key = canonicalInContext(block);
    pool.set(key, [...(pool.get(key) ?? []), block]);
  }
  const blocks = splitBlocks(manager, trimmedNext).map(({ raw }) => {
    const match = pool.get(raw)?.shift();
    return match ? { raw: match.raw, from: match } : { raw, from: undefined };
  });

  let joined = "";
  for (const [i, block] of blocks.entries()) {
    if (i > 0) {
      const previous = blocks[i - 1]!.from;
      const current = block.from;
      const adjacent = previous && current && current.index === previous.index + 1 && previous.end >= 0 && current.start >= 0;
      joined += adjacent ? original.slice(previous.end, current.start) : "\n\n";
    }
    joined += block.raw;
  }
  return original.endsWith("\n") ? `${joined}\n` : joined;
}

/** The editor's content as markdown, relative to the last loaded or saved `original`. */
export function toMarkdown(editor: Editor, original: string): string {
  const manager = editor.markdown;
  if (!manager) throw new Error("MarkdownEditor needs the Markdown extension");
  return preserveUnchangedBlocks(manager, original, editor.getMarkdown());
}
