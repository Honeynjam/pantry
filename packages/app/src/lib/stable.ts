import { useState } from "react";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;

const idOf = (value: unknown) =>
  isPlainObject(value) && typeof value._id === "string" ? value._id : undefined;

/**
 * `next`, with every part that equals the matching part of `prev` replaced by `prev`'s object, so
 * unchanged rows keep their identity and memoised components skip them. Array items with an `_id`
 * are matched by id (an issue moving up a list is still the same object), others by position.
 * Returns `prev` itself when nothing changed. Never mutates either side.
 *
 * Convex hands over a brand-new result for every change to a query, however small: without this,
 * one issue changing re-renders every row of the list.
 */
export function reuseEqual<T>(prev: unknown, next: T): T {
  if (Object.is(prev, next)) return next;
  if (Array.isArray(prev) && Array.isArray(next)) {
    const byId = new Map<string, unknown>();
    for (const item of prev) {
      const id = idOf(item);
      if (id !== undefined) byId.set(id, item);
    }
    let same = prev.length === next.length;
    const out = next.map((item, index) => {
      const id = idOf(item);
      const before =
        id !== undefined ? byId.get(id) : idOf(prev[index]) === undefined ? prev[index] : undefined;
      const kept = reuseEqual(before, item);
      if (kept !== prev[index]) same = false;
      return kept;
    });
    return (same ? prev : out) as T;
  }
  if (isPlainObject(prev) && isPlainObject(next)) {
    const keys = Object.keys(next);
    let same = keys.length === Object.keys(prev).length;
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      const kept = reuseEqual(prev[key], next[key]);
      if (kept !== prev[key] || !(key in prev)) same = false;
      out[key] = kept;
    }
    return (same ? prev : out) as T;
  }
  return next;
}

/**
 * A query result (or any value) that keeps the identity of everything that didn't change since the
 * last render (`reuseEqual`). Uses React's "adjust state while rendering" pattern: when the value
 * changes, this component renders once more before its children do.
 */
export function useStable<T>(value: T): T {
  const [stable, setStable] = useState(value);
  const next = reuseEqual(stable, value);
  if (next !== stable) setStable(next);
  return next;
}
