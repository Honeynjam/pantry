// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { helpSections, SHORTCUT_IDS, SHORTCUTS, ShortcutRegistry, type ShortcutId } from "./shortcuts";

/** The shortcuts spec §4 lists, in Keycap notation. */
const SPEC_SHORTCUTS = [
  "mod+k", "c", "shift+c", "/",
  "j", "k", "enter", "esc", "x",
  "s", "a", "i", "l", "p", "d",
  "mod+enter", "g i", "g p", "g b", "?",
];

const CODES: Record<string, string> = { "/": "Slash", "?": "Slash", "[": "BracketLeft", Enter: "Enter", Escape: "Escape" };

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) {
  const code = CODES[key] ?? `Key${key.toUpperCase()}`;
  const event = new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

const mod = /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true };

describe("the registry and the ? help", () => {
  it("registers every shortcut in spec §4", () => {
    const registered = SHORTCUTS.map((def) => def.display);
    for (const keys of SPEC_SHORTCUTS) expect(registered).toContain(keys);
  });

  it("the help lists every registered shortcut exactly once", () => {
    const listed = helpSections().flatMap((section) => section.rows.map((row) => row.id));
    expect([...listed].sort()).toEqual(SHORTCUTS.map((def) => def.id).sort());
    expect([...listed].sort()).toEqual([...SHORTCUT_IDS].sort());
  });

  it("has no two shortcuts on the same keys in the same place", () => {
    const seen = new Set<string>();
    for (const def of SHORTCUTS) {
      for (const where of def.where) {
        const slot = `${where}:${def.binding.toLowerCase()}`;
        expect(seen.has(slot), slot).toBe(false);
        seen.add(slot);
      }
    }
  });

  it("puts sequences before the single keys they share a letter with", () => {
    const index = (id: ShortcutId) => SHORTCUTS.findIndex((def) => def.id === id);
    expect(index("goMyIssues")).toBeLessThan(index("assignToMe"));
    expect(index("goProject")).toBeLessThan(index("priority"));
  });
});

describe("dispatch", () => {
  let registry: ShortcutRegistry;
  let unbind: () => void;
  const fired: string[] = [];
  const on = (id: ShortcutId, scope: Parameters<ShortcutRegistry["register"]>[1], name = `${scope}:${id}`) =>
    registry.register(id, scope, () => void fired.push(name));

  beforeEach(() => {
    vi.useFakeTimers();
    fired.length = 0;
    document.body.innerHTML = "";
    registry = new ShortcutRegistry();
    unbind = registry.bind(window);
  });
  afterEach(() => {
    unbind();
    vi.useRealTimers();
  });

  it("fires a global shortcut and prevents the default", () => {
    on("newIssue", "global");
    const event = press("c");
    expect(fired).toEqual(["global:newIssue"]);
    expect(event.defaultPrevented).toBe(true);
  });

  it("never fires letter keys while typing, in inputs, textareas or editors", () => {
    on("newIssue", "global");
    on("next", "list");
    registry.push("list");
    document.body.innerHTML = `<input id="i" /><textarea id="t"></textarea><div contenteditable="true"><p id="p">x</p></div>`;
    for (const id of ["i", "t", "p"]) {
      press("c", {}, document.getElementById(id)!);
      press("j", {}, document.getElementById(id)!);
    }
    expect(fired).toEqual([]);
  });

  it("lets Cmd/Ctrl+K through while typing", () => {
    on("palette", "global");
    document.body.innerHTML = `<input id="i" />`;
    press("k", mod, document.getElementById("i")!);
    expect(fired).toEqual(["global:palette"]);
  });

  it("runs sequences (G then I) instead of the single key", () => {
    on("goMyIssues", "global");
    on("assignToMe", "list");
    registry.push("list");
    press("g");
    press("i");
    expect(fired).toEqual(["global:goMyIssues"]);
    press("i");
    expect(fired).toEqual(["global:goMyIssues", "list:assignToMe"]);
  });

  it("drops a sequence after a second", () => {
    on("goBoard", "global");
    press("g");
    vi.advanceTimersByTime(1100);
    press("b");
    expect(fired).toEqual([]);
  });

  it("tells Shift+C from C and ? from /", () => {
    on("newIssue", "global");
    on("newSubIssue", "issue");
    on("search", "global");
    on("help", "global");
    registry.push("issue");
    press("C", { shiftKey: true });
    press("c");
    press("?", { shiftKey: true });
    press("/");
    expect(fired).toEqual(["issue:newSubIssue", "global:newIssue", "global:help", "global:search"]);
  });

  it("sends keys to the top scope: page over global, overlay over everything", () => {
    on("search", "global");
    on("search", "list");
    on("next", "list");
    on("escape", "list");
    on("escape", "issue");

    press("/");
    press("j"); // no list on screen: nothing handles J
    expect(fired).toEqual(["global:search"]);

    const popList = registry.push("list");
    press("/");
    press("j");
    press("Escape");
    expect(fired.slice(1)).toEqual(["list:search", "list:next", "list:escape"]);

    const popOverlay = registry.push("overlay");
    press("/");
    press("j");
    press("Escape");
    expect(fired).toHaveLength(4);
    popOverlay();

    const popIssue = registry.push("issue");
    press("Escape");
    press("j"); // the issue page is on top of the list: J goes nowhere
    expect(fired.slice(4)).toEqual(["issue:escape"]);
    popIssue();
    popList();
    press("Escape");
    expect(fired).toHaveLength(5);
  });

  it("treats focus inside an open menu or dialog as an overlay", () => {
    on("status", "list");
    registry.push("list");
    document.body.innerHTML = `<div role="menu"><div role="menuitem" tabindex="-1" id="m">Todo</div></div>`;
    press("s", {}, document.getElementById("m")!);
    expect(fired).toEqual([]);
    press("s");
    expect(fired).toEqual(["list:status"]);
  });

  it("gives keys pressed in a closing dialog to the page", () => {
    on("assignee", "list");
    registry.push("list");
    document.body.innerHTML = `<div role="dialog" data-closed data-ending-style><input id="i" /></div>`;
    press("a", {}, document.getElementById("i")!);
    expect(fired).toEqual(["list:assignee"]);
  });

  it("lets a handler decline a key, which then keeps its default", () => {
    registry.register("open", "list", () => false);
    registry.push("list");
    const event = press("Enter");
    expect(event.defaultPrevented).toBe(false);
  });

  it("repeats only J and K while held", () => {
    on("next", "list");
    on("select", "list");
    registry.push("list");
    press("j", { repeat: true });
    press("x", { repeat: true });
    expect(fired).toEqual(["list:next"]);
  });

  it("uses the latest handler when two register in one scope, and unregisters cleanly", () => {
    const off = on("newIssue", "global", "first");
    const offSecond = on("newIssue", "global", "second");
    press("c");
    offSecond();
    press("c");
    off();
    press("c");
    expect(fired).toEqual(["second", "first"]);
  });
});
