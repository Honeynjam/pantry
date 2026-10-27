import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { markdownExtensions, toMarkdown } from "../src/lib/markdown";

// Vitest runs from the package root (happy-dom gives import.meta.url an http scheme).
const dir = join(process.cwd(), "test/fixtures/markdown");
const fixtures = readdirSync(dir)
  .filter((name) => name.endsWith(".md"))
  .sort()
  .map((name) => [name, readFileSync(join(dir, name), "utf8")] as const);

let editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors) editor.destroy();
  editors = [];
});

/** A headless editor loaded the way MarkdownEditor loads content. */
function load(markdown: string): Editor {
  const editor = new Editor({
    extensions: markdownExtensions(),
    content: markdown,
    contentType: "markdown",
  });
  editors.push(editor);
  return editor;
}

/** Top-level blocks as marked splits them (what must survive verbatim). */
function blocks(editor: Editor, markdown: string): string[] {
  return editor
    .markdown!.instance.lexer(markdown)
    .filter((token) => token.type !== "space")
    .map((token) => token.raw.replace(/\n+$/, ""))
    .filter((raw) => raw.trim());
}

describe("markdown fixtures", () => {
  it("has a fixture set", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(8);
  });

  it.each(fixtures)("%s round-trips unchanged when untouched", (_name, markdown) => {
    const editor = load(markdown);
    expect(toMarkdown(editor, markdown)).toBe(markdown);
  });

  it.each(fixtures.filter(([, markdown]) => markdown.trim()))(
    "%s keeps every block verbatim when a paragraph is added above it",
    (_name, markdown) => {
      const editor = load(markdown);
      editor
        .chain()
        .insertContentAt(0, {
          type: "paragraph",
          content: [{ type: "text", text: "Added by a person." }],
        })
        .run();
      const saved = toMarkdown(editor, markdown);
      expect(saved.startsWith("Added by a person.\n\n")).toBe(true);
      for (const block of blocks(editor, markdown)) expect(saved).toContain(block);
      // Untouched neighbours keep their spacing too, so the rest is the original document.
      expect(saved).toBe(`Added by a person.\n\n${markdown}`);
      // And it loads again to the same document.
      expect(toMarkdown(load(saved), saved)).toBe(saved);
    },
  );
});

describe("constructs Tiptap can't represent", () => {
  it("keeps tables, HTML and link definitions as editable raw blocks", () => {
    const markdown =
      "| a | b |\n|---|---|\n| 1 | 2 |\n\n<div>html</div>\n\n[ref]: https://example.com\n";
    const editor = load(markdown);
    const types = (editor.getJSON().content ?? []).map((node) => node.type);
    expect(types).toEqual(["rawMarkdownBlock", "rawMarkdownBlock", "rawMarkdownBlock"]);

    // Edit the table's source text: the change is saved, the other raw blocks stay.
    const tableEnd = editor.state.doc.child(0).nodeSize - 1;
    editor.chain().insertContentAt(tableEnd, "\n| 3 | 4 |").run();
    const saved = toMarkdown(editor, markdown);
    expect(saved).toBe(
      "| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n\n<div>html</div>\n\n[ref]: https://example.com\n",
    );
  });

  it("keeps an image when its paragraph is edited", () => {
    const markdown = "See ![the board](https://example.com/b.png) here.\n";
    const editor = load(markdown);
    editor.chain().focus("end").insertContent(" Edited.").run();
    expect(toMarkdown(editor, markdown)).toBe(
      "See ![the board](https://example.com/b.png) here. Edited.\n",
    );
  });

  it("saves new content from an empty document", () => {
    const editor = load("");
    editor.chain().insertContent("**Hello**").run();
    expect(toMarkdown(editor, "")).toBe("\\*\\*Hello\\*\\*");
  });

  it("returns an empty string when everything is deleted", () => {
    const markdown = "# Gone\n\nAll of it.\n";
    const editor = load(markdown);
    editor.commands.clearContent();
    expect(toMarkdown(editor, markdown)).toBe("");
  });

  it("keeps the original spacing between untouched neighbours", () => {
    const markdown =
      "Para one.\n\n\nPara two.\n[ref]: https://example.com\nTail paragraph.\n\nLast one.\n";
    const editor = load(markdown);
    editor.chain().focus("end").insertContent(" Edited.").run();
    expect(toMarkdown(editor, markdown)).toBe(
      "Para one.\n\n\nPara two.\n[ref]: https://example.com\nTail paragraph.\n\nLast one. Edited.\n",
    );
  });

  it("writes Tiptap's markdown for edited blocks", () => {
    const markdown = "Some *text*.\n";
    const editor = load(markdown);
    editor.chain().focus("end").insertContent(" More.").run();
    expect(toMarkdown(editor, markdown)).toBe("Some *text*. More.\n");
  });
});
