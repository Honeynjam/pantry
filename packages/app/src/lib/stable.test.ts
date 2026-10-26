import { describe, expect, it } from "vitest";
import { reuseEqual } from "./stable";

const row = (id: string, extra: Record<string, unknown> = {}) => ({ _id: id, title: `Issue ${id}`, labelIds: ["a"], ...extra });

describe("reuseEqual", () => {
  it("returns the previous value when nothing changed", () => {
    const prev = { list: [row("1"), row("2")], count: 2 };
    expect(reuseEqual(prev, structuredClone(prev))).toBe(prev);
  });

  it("keeps unchanged rows and replaces only the changed one", () => {
    const prev = [row("1"), row("2"), row("3")];
    const next = [row("1"), row("2", { title: "Renamed" }), row("3")];
    const out = reuseEqual(prev, next);
    expect(out).not.toBe(prev);
    expect(out[0]).toBe(prev[0]);
    expect(out[1]).not.toBe(prev[1]);
    expect(out[1]).toEqual(next[1]);
    // Inside a changed row, unchanged parts are reused too.
    expect(out[1]!.labelIds).toBe(prev[1]!.labelIds);
    expect(out[2]).toBe(prev[2]);
    expect(out).toEqual(next);
  });

  it("matches rows by _id, so a reordered or inserted row doesn't shift the rest", () => {
    const prev = [row("1"), row("2"), row("3")];
    const out = reuseEqual(prev, [row("0"), row("3"), row("1"), row("2")]);
    expect(out[1]).toBe(prev[2]);
    expect(out[2]).toBe(prev[0]);
    expect(out[3]).toBe(prev[1]);
    expect(out.map((item) => item._id)).toEqual(["0", "3", "1", "2"]);
  });

  it("notices removed, added and changed fields, and nested arrays", () => {
    const prev = { ...row("1"), assigneeId: "m1" };
    const { assigneeId: _assigneeId, ...unassigned } = prev;
    expect(reuseEqual(prev, unassigned)).toEqual(unassigned);
    expect(reuseEqual(prev, unassigned)).not.toBe(prev);
    expect(reuseEqual(prev, { ...prev, dueDate: "2026-11-01" })).not.toBe(prev);
    expect(reuseEqual(prev, { ...prev, labelIds: ["a", "b"] }).labelIds).toEqual(["a", "b"]);
    expect(reuseEqual(prev, { ...prev, labelIds: ["a"] })).toBe(prev);
  });

  it("never mutates either side", () => {
    const prev = Object.freeze([Object.freeze(row("1")), Object.freeze(row("2"))]);
    const next = Object.freeze([Object.freeze(row("2")), Object.freeze(row("1", { title: "New" }))]);
    expect(() => reuseEqual(prev, next)).not.toThrow();
    expect(reuseEqual(prev, next)[0]).toBe(prev[1]);
  });

  it("handles undefined, null and primitives", () => {
    expect(reuseEqual(undefined, [row("1")])).toEqual([row("1")]);
    expect(reuseEqual([row("1")], undefined)).toBeUndefined();
    expect(reuseEqual(null, null)).toBeNull();
    expect(reuseEqual(1, 2)).toBe(2);
  });
});
