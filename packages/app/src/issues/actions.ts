"use client";

import { api } from "@pantry/backend/api";
import type { Id } from "@pantry/backend/dataModel";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { useMemo } from "react";
import { toast } from "sonner";
import { describeError } from "../screens/form-error";
import { optimisticMove, optimisticUpdate } from "./optimistic";

export type IssueActions = ReturnType<typeof useIssueActions>;

export type IssuePatch = Omit<FunctionArgs<typeof api.issues.update>, "issueId">;

/**
 * Issue writes used by every view, with errors shown as toasts. Both are optimistic (see
 * optimistic.ts): list, board, My issues and the issue page change at once, and Convex rolls the
 * change back if the server refuses it.
 */
export function useIssueActions() {
  // withOptimisticUpdate returns a new function on every call: build them once per mutation, so the
  // actions object stays the same between renders and memoised rows don't re-render for it.
  const rawUpdate = useMutation(api.issues.update);
  const rawMove = useMutation(api.issues.move);
  const update = useMemo(
    () => rawUpdate.withOptimisticUpdate((store, args) => optimisticUpdate(store, args)),
    [rawUpdate],
  );
  const move = useMemo(
    () => rawMove.withOptimisticUpdate((store, args) => optimisticMove(store, args)),
    [rawMove],
  );
  return useMemo(
    () => ({
      update: async (issueId: Id<"issues">, patch: IssuePatch) => {
        try {
          await update({ issueId, ...patch });
        } catch (err) {
          toast.error(describeError(err, "Couldn't update the issue."));
        }
      },
      move: async (
        issueId: Id<"issues">,
        statusId: Id<"statuses">,
        placement: { beforeId?: Id<"issues">; afterId?: Id<"issues"> } = {},
      ) => {
        try {
          await move({ issueId, statusId, ...placement });
        } catch (err) {
          toast.error(describeError(err, "Couldn't move the issue."));
        }
      },
    }),
    [update, move],
  );
}
