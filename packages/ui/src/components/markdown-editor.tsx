"use client";

import * as React from "react";
import { Extension } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { markdownExtensions, toMarkdown } from "@pantry/ui/lib/markdown";
import { cn } from "@pantry/ui/lib/utils";

export type MarkdownEditorHandle = {
  focus: () => void;
  /** Empties the editor and forgets the baseline (after a comment is posted). */
  clear: () => void;
  isEmpty: () => boolean;
  getMarkdown: () => string;
  /** Put text back as an unsaved edit (a comment the server refused). */
  setMarkdown: (markdown: string) => void;
};

type Callbacks = {
  onSave?: (markdown: string) => void;
  onSubmit?: (markdown: string) => void;
  onEscape?: () => void;
};

/**
 * Markdown in, markdown out (spec §9d), on Tiptap 3, styled to our tokens. The same component renders
 * read-only content (`editable={false}`).
 *
 * - `onSave` runs on blur and on Cmd/Ctrl+Enter, and only when the text changed: never per keystroke.
 *   Untouched blocks keep their exact source text (see lib/markdown.ts).
 * - `onSubmit` (comments) takes Cmd/Ctrl+Enter instead; the parent calls `clear()` once it's posted.
 * - Esc leaves the editor (which saves, like blur).
 * - A new `value` from the server replaces the content unless you're mid-edit; your edit then wins
 *   when it's saved.
 */
function MarkdownEditor({
  value,
  editable = true,
  placeholder,
  onSave,
  onSubmit,
  onEscape,
  autoFocus = false,
  className,
  contentClassName,
  ref,
  ...props
}: Callbacks & {
  value: string;
  editable?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  /** Classes for the editable area itself (padding, min height). */
  contentClassName?: string;
  ref?: React.Ref<MarkdownEditorHandle>;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const baseline = React.useRef(value);
  const dirty = React.useRef(false);
  const callbacks = React.useRef<Callbacks>({ onSave, onSubmit, onEscape });
  React.useEffect(() => {
    callbacks.current = { onSave, onSubmit, onEscape };
  });

  const save = React.useCallback((editor: Editor) => {
    if (!dirty.current) return;
    dirty.current = false;
    const markdown = toMarkdown(editor, baseline.current);
    if (markdown === baseline.current) return;
    baseline.current = markdown;
    callbacks.current.onSave?.(markdown);
  }, []);

  const editor = useEditor(
    {
      extensions: [
        ...markdownExtensions({ openLinksOnClick: !editable }),
        Placeholder.configure({ placeholder: placeholder ?? "" }),
        Extension.create({
          name: "pantryEditorKeys",
          addKeyboardShortcuts() {
            return {
              "Mod-Enter": ({ editor }) => {
                const submit = callbacks.current.onSubmit;
                if (submit) {
                  if (!editor.isEmpty) submit(toMarkdown(editor, baseline.current));
                } else {
                  save(editor);
                }
                return true;
              },
              Escape: ({ editor }) => {
                editor.commands.blur();
                callbacks.current.onEscape?.();
                return true;
              },
            };
          },
        }),
      ],
      content: value,
      contentType: "markdown",
      editable,
      autofocus: autoFocus ? "end" : false,
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      editorProps: {
        attributes: {
          class: cn("markdown outline-none", contentClassName),
          ...(props["aria-label"] ? { "aria-label": props["aria-label"] } : {}),
          ...(props["aria-labelledby"] ? { "aria-labelledby": props["aria-labelledby"] } : {}),
          ...(editable ? { role: "textbox", "aria-multiline": "true" } : {}),
        },
      },
      onUpdate: () => {
        dirty.current = true;
      },
      onBlur: ({ editor }) => {
        if (!callbacks.current.onSubmit) save(editor);
      },
    },
    [],
  );

  React.useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable, false);
  }, [editor, editable]);

  // Live updates: take the server's text unless the user is in the middle of an edit.
  React.useEffect(() => {
    if (!editor || value === baseline.current) return;
    if (dirty.current && editor.isFocused) return;
    editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
    baseline.current = value;
    dirty.current = false;
  }, [editor, value]);

  React.useImperativeHandle(
    ref,
    () => ({
      focus: () => editor?.commands.focus("end"),
      clear: () => {
        editor?.commands.clearContent(false);
        baseline.current = "";
        dirty.current = false;
      },
      isEmpty: () => editor?.isEmpty ?? true,
      getMarkdown: () => (editor ? toMarkdown(editor, baseline.current) : baseline.current),
      setMarkdown: (markdown: string) => {
        editor?.commands.setContent(markdown, { contentType: "markdown", emitUpdate: false });
        dirty.current = true;
      },
    }),
    [editor],
  );

  return <EditorContent editor={editor} data-slot="markdown-editor" className={className} />;
}

export { MarkdownEditor };
