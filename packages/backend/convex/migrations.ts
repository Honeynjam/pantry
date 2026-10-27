import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import { isLegacyProject, isProject, type LegacyProject } from "./lib/model";

/**
 * M2 → Spaces data migration (docs/MIGRATIONS.md). M2 kept products in `projects` (key, counter)
 * and pointed issues and the context doc at them; the Spaces release moves those rows to `spaces`.
 *
 *   npx convex run migrations:run          (local; `pnpm dev` runs it on start)
 *   npx convex run --prod migrations:run   (scripts/vercel-build.sh runs it after `convex deploy`)
 *
 * Every step is idempotent and works in batches (one mutation each), so it stays inside Convex's
 * per-transaction limits for any number of issues and is safe to re-run after a partial run.
 * Spaces are matched to their M2 project by workspace + key (keys are unique per workspace), so
 * no mapping table is needed and a re-run finds the spaces it already made.
 */

const DEFAULT_BATCH = 100;
const batchArgs = { cursor: v.union(v.string(), v.null()), batchSize: v.number() };
type Batch = { cursor: string | null; batchSize: number };

async function spaceFor(ctx: QueryCtx, legacy: LegacyProject) {
  return ctx.db
    .query("spaces")
    .withIndex("by_workspace_and_key", (q) =>
      q.eq("workspaceId", legacy.workspaceId).eq("key", legacy.key),
    )
    .first();
}

/** Step 1: a space for every M2 project (same name, key, counter and archive state). */
export const migrateSpaces = internalMutation({
  args: batchArgs,
  handler: async (ctx, { cursor, batchSize }: Batch) => {
    const page = await ctx.db.query("projects").paginate({ cursor, numItems: batchSize });
    let created = 0;
    let existing = 0;
    for (const row of page.page) {
      if (!isLegacyProject(row)) continue;
      const space = await spaceFor(ctx, row);
      if (space) {
        existing += 1;
        // Never hand out a number twice.
        if (space.nextIssueNumber < row.nextIssueNumber) {
          await ctx.db.patch("spaces", space._id, { nextIssueNumber: row.nextIssueNumber });
        }
        continue;
      }
      await ctx.db.insert("spaces", {
        workspaceId: row.workspaceId,
        name: row.name,
        key: row.key,
        nextIssueNumber: row.nextIssueNumber,
        ...(row.archivedAt !== undefined ? { archivedAt: row.archivedAt } : {}),
      });
      created += 1;
    }
    return { created, existing, cursor: page.continueCursor, isDone: page.isDone };
  },
});

/**
 * Step 2: every issue gets its `spaceId`. An M2 issue's `projectId` (its M2 project) is cleared; a
 * `projectId` that points at a real workstream is kept. Issues whose project row is gone and that
 * have no space are reported, never guessed.
 */
export const migrateIssues = internalMutation({
  args: batchArgs,
  handler: async (ctx, { cursor, batchSize }: Batch) => {
    const page = await ctx.db.query("issues").paginate({ cursor, numItems: batchSize });
    const refs = new Map<Id<"projects">, Doc<"projects"> | null>();
    const ref = async (id: Id<"projects">) => {
      if (!refs.has(id)) refs.set(id, await ctx.db.get("projects", id));
      return refs.get(id)!;
    };
    let migrated = 0;
    let unchanged = 0;
    let cleared = 0;
    const orphans: string[] = [];
    for (const issue of page.page) {
      const target = issue.projectId ? await ref(issue.projectId) : null;
      if (target && isProject(target)) {
        if (issue.spaceId) unchanged += 1;
        else {
          await ctx.db.patch("issues", issue._id, { spaceId: target.spaceId });
          migrated += 1;
        }
      } else if (target && isLegacyProject(target)) {
        const space = await spaceFor(ctx, target);
        if (!space) throw new Error(`No space for ${target.key} yet: run migrateSpaces first.`);
        await ctx.db.patch("issues", issue._id, {
          spaceId: issue.spaceId ?? space._id,
          projectId: undefined,
        });
        migrated += 1;
      } else if (issue.projectId) {
        // The project row is gone.
        if (issue.spaceId) {
          await ctx.db.patch("issues", issue._id, { projectId: undefined });
          cleared += 1;
        } else orphans.push(issue.key);
      } else if (issue.spaceId) unchanged += 1;
      else orphans.push(issue.key);
    }
    return {
      migrated,
      unchanged,
      cleared,
      orphans,
      cursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/** Step 3: M2 context docs (`project_context` on a `projectId`) become `space_context` docs. */
export const migrateDocs = internalMutation({
  args: batchArgs,
  handler: async (ctx, { cursor, batchSize }: Batch) => {
    const page = await ctx.db.query("docs").paginate({ cursor, numItems: batchSize });
    let migrated = 0;
    let unchanged = 0;
    const orphans: string[] = [];
    for (const doc of page.page) {
      if (
        doc.kind === "space_context" &&
        doc.projectId === undefined &&
        doc.spaceId !== undefined
      ) {
        unchanged += 1;
        continue;
      }
      const target = doc.projectId ? await ctx.db.get("projects", doc.projectId) : null;
      const space = target && isLegacyProject(target) ? await spaceFor(ctx, target) : null;
      const spaceId = doc.spaceId ?? space?._id;
      if (!spaceId) {
        orphans.push(doc.title);
        continue;
      }
      await ctx.db.patch("docs", doc._id, { spaceId, kind: "space_context", projectId: undefined });
      migrated += 1;
    }
    return { migrated, unchanged, orphans, cursor: page.continueCursor, isDone: page.isDone };
  },
});

/**
 * Step 4: delete the M2 project rows, once nothing points at them any more and their space
 * exists. Anything still referenced is kept and reported.
 */
export const removeLegacyProjects = internalMutation({
  args: batchArgs,
  handler: async (ctx, { cursor, batchSize }: Batch) => {
    const page = await ctx.db
      .query("projects")
      .withIndex("by_space", (q) => q.eq("spaceId", undefined))
      .paginate({ cursor, numItems: batchSize });
    let deleted = 0;
    const kept: string[] = [];
    for (const row of page.page) {
      if (!isLegacyProject(row)) continue;
      const issue = await ctx.db
        .query("issues")
        .withIndex("by_project", (q) => q.eq("projectId", row._id))
        .first();
      const doc = await ctx.db
        .query("docs")
        .withIndex("by_project", (q) => q.eq("projectId", row._id))
        .first();
      if (issue || doc || !(await spaceFor(ctx, row))) {
        kept.push(row.key);
        continue;
      }
      await ctx.db.delete("projects", row._id);
      deleted += 1;
    }
    return { deleted, kept, cursor: page.continueCursor, isDone: page.isDone };
  },
});

export type MigrationSummary = {
  spacesCreated: number;
  spacesExisting: number;
  issuesMigrated: number;
  issuesUnchanged: number;
  danglingProjectRefsCleared: number;
  docsMigrated: number;
  docsUnchanged: number;
  legacyProjectsDeleted: number;
  problems: string[];
};

/**
 * Runs the four steps in order, batch by batch, and logs what it did. Throws (failing the deploy)
 * when something couldn't be migrated, after migrating everything else.
 */
export const run = internalAction({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, args): Promise<MigrationSummary> => {
    const batchSize = Math.max(1, Math.min(500, Math.floor(args.batchSize ?? DEFAULT_BATCH)));
    const summary: MigrationSummary = {
      spacesCreated: 0,
      spacesExisting: 0,
      issuesMigrated: 0,
      issuesUnchanged: 0,
      danglingProjectRefsCleared: 0,
      docsMigrated: 0,
      docsUnchanged: 0,
      legacyProjectsDeleted: 0,
      problems: [],
    };
    async function pages<R extends { cursor: string; isDone: boolean }>(
      step: (batch: Batch) => Promise<R>,
      each: (result: R) => void,
    ) {
      let cursor: string | null = null;
      for (;;) {
        const result: R = await step({ cursor, batchSize });
        each(result);
        if (result.isDone) return;
        cursor = result.cursor;
      }
    }

    await pages(
      (batch) => ctx.runMutation(internal.migrations.migrateSpaces, batch),
      (r) => {
        summary.spacesCreated += r.created;
        summary.spacesExisting += r.existing;
      },
    );
    await pages(
      (batch) => ctx.runMutation(internal.migrations.migrateIssues, batch),
      (r) => {
        summary.issuesMigrated += r.migrated;
        summary.issuesUnchanged += r.unchanged;
        summary.danglingProjectRefsCleared += r.cleared;
        for (const key of r.orphans)
          summary.problems.push(`Issue ${key} has no space and its project is gone.`);
      },
    );
    await pages(
      (batch) => ctx.runMutation(internal.migrations.migrateDocs, batch),
      (r) => {
        summary.docsMigrated += r.migrated;
        summary.docsUnchanged += r.unchanged;
        for (const title of r.orphans)
          summary.problems.push(`Doc "${title}" has no space and its project is gone.`);
      },
    );
    await pages(
      (batch) => ctx.runMutation(internal.migrations.removeLegacyProjects, batch),
      (r) => {
        summary.legacyProjectsDeleted += r.deleted;
        for (const key of r.kept)
          summary.problems.push(`M2 project ${key} is still referenced; kept.`);
      },
    );

    console.log(
      `Spaces migration: ${summary.spacesCreated} spaces created (${summary.spacesExisting} already there), ` +
        `${summary.issuesMigrated} issues moved to their space (${summary.issuesUnchanged} already done, ` +
        `${summary.danglingProjectRefsCleared} dangling project refs cleared), ${summary.docsMigrated} context docs ` +
        `moved (${summary.docsUnchanged} already done), ${summary.legacyProjectsDeleted} M2 project rows deleted.`,
    );
    if (summary.problems.length > 0) {
      throw new Error(`Spaces migration incomplete:\n- ${summary.problems.join("\n- ")}`);
    }
    return summary;
  },
});

/** What's left to migrate, from indexes only (cheap at any size). Counts stop at 1,000. */
async function remaining(ctx: QueryCtx) {
  const [legacyProjects, issuesWithoutSpace, legacyDocs] = await Promise.all([
    ctx.db
      .query("projects")
      .withIndex("by_space", (q) => q.eq("spaceId", undefined))
      .take(1000),
    ctx.db
      .query("issues")
      .withIndex("by_space_and_status", (q) => q.eq("spaceId", undefined))
      .take(1000),
    ctx.db
      .query("docs")
      .withIndex("by_space_and_kind", (q) => q.eq("spaceId", undefined))
      .take(1000),
  ]);
  return {
    legacyProjects: legacyProjects.filter(isLegacyProject).length,
    issuesWithoutSpace: issuesWithoutSpace.length,
    legacyDocs: legacyDocs.length,
  };
}

/** Counts of M2 rows still waiting (all zero once migrated). */
export const status = internalQuery({ args: {}, handler: (ctx) => remaining(ctx) });

/**
 * The guard for narrowing the schema (docs/MIGRATIONS.md): throws while any M2 row remains. The
 * build runs it after `migrations:run`; the narrowing release runs it before it deploys.
 */
export const assertMigrated = internalQuery({
  args: {},
  handler: async (ctx) => {
    const left = await remaining(ctx);
    const total = left.legacyProjects + left.issuesWithoutSpace + left.legacyDocs;
    if (total > 0) {
      throw new Error(
        `Not migrated yet: ${left.legacyProjects} M2 projects, ${left.issuesWithoutSpace} issues without a space, ` +
          `${left.legacyDocs} context docs without a space. Run \`npx convex run migrations:run\` ` +
          "(add --prod for production), and deploy the Spaces release before any release that narrows the schema.",
      );
    }
    return { ok: true, ...left };
  },
});
