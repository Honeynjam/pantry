"use client";

import { api } from "@pantry/backend/api";
import type { Id } from "@pantry/backend/dataModel";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { useMemo } from "react";
import { toast } from "sonner";
import { describeError } from "../screens/form-error";

export type IssueActions = ReturnType<typeof useIssueActions>;

export type IssuePatch = Omit<FunctionArgs<typeof api.issues.update>, "issueId">;

/**
 * Issue writes used by every view, with errors shown as toasts. M3 adds optimistic updates here,
 * so list, board and detail all get them at once.
 */
export function useIssueActions() {
  const update = useMutation(api.issues.update);
  const move = useMutation(api.issues.move);
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
