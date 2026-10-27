import type { CallToolResult, McpServer, ServerContext } from "@modelcontextprotocol/server";
import { api } from "@pantry/backend/api";
import { brand } from "@pantry/backend/brand";
import { PRIORITY_NAMES } from "@pantry/backend/priority";
import type { FunctionArgs } from "convex/server";
import { z } from "zod";
import type { PantryAuthExtra } from "./auth";
import type { Backend } from "./backend";

/**
 * The seven MCP tools (spec §6, §10b "MCP tools"). Thin adapters: zod checks the shape, Convex
 * (`convex/mcp.ts`) checks the token, resolves names inside the token's workspace and writes through
 * the app's helpers. A refusal from Convex (an unknown status, project, label…) comes back as
 * `isError: true` with its message, which lists the valid values so the agent can retry.
 */

const KEY = brand.defaultKey;
const ISSUE_KEY = /^[A-Z][A-Z0-9]{1,9}-\d+$/;

export const SERVER_INSTRUCTIONS = [
  `${brand.name} is the team's issue tracker. Work starts from an issue key like ${KEY}-42.`,
  `Before starting work on an issue, call get_issue and then get_space_context for its space (the part of the key before the dash) and follow that doc.`,
  `Nothing changes status by itself: move the issue to "In Progress" with update_issue when you start and to "In Review" when you're done,`,
  `post progress notes and findings with add_comment, and add follow-ups with create_sub_issue.`,
  `Everything you do shows under the token owner's name, tagged "via MCP".`,
].join(" ");

const READ_FIRST = `Call get_space_context for the issue's space before you start work.`;

// ---------------------------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------------------------

const issueKey = z
  .string()
  .trim()
  .toUpperCase()
  .regex(ISSUE_KEY, `An issue key looks like ${KEY}-42.`)
  .describe(`Issue key, like ${KEY}-42`);
const spaceKey = z
  .string()
  .trim()
  .min(1)
  .max(10)
  .describe(`Space key, like ${KEY} (the part of an issue key before the dash)`);
const name = (what: string) => z.string().trim().min(1).max(80).describe(what);
const priorityInput = z
  .union([z.enum(PRIORITY_NAMES), z.number().int().min(0).max(4)])
  .describe('Priority: "none", "urgent", "high", "medium" or "low" (or 0–4 in that order)');
const assignee = name(`Assignee: "me" (the token's owner), "none", or a member's display name`);
const CATEGORIES = [
  "backlog",
  "unstarted",
  "started",
  "review",
  "done",
  "canceled",
] as const satisfies readonly NonNullable<FunctionArgs<typeof api.mcp.listIssues>["category"]>[];

const toPriority = (value: z.infer<typeof priorityInput> | undefined) =>
  value === undefined
    ? undefined
    : typeof value === "number"
      ? (value as 0 | 1 | 2 | 3 | 4)
      : (PRIORITY_NAMES.indexOf(value) as 0 | 1 | 2 | 3 | 4);

/** Drops undefined values, so Convex validators only see the fields that were given. */
function defined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;
}

export const schemas = {
  get_issue: z.object({ key: issueKey }),
  get_space_context: z.object({ space: spaceKey }),
  list_issues: z.object({
    space: spaceKey.optional(),
    project: name(
      'Project name inside `space` (needs `space`), or "none" for issues without a project',
    ).optional(),
    status: name(`Status name, like "In Progress"`).optional(),
    category: z.enum(CATEGORIES).optional().describe("Status category"),
    assignee: assignee.optional(),
    label: name("Label name").optional(),
    priority: priorityInput.optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("How many to return (default 50, at most 100)"),
  }),
  create_issue: z.object({
    space: spaceKey,
    project: name('Project name inside the space, or "none"').optional(),
    title: z.string().trim().min(1).max(200).describe("Title, up to 200 characters"),
    description: z.string().max(100_000).optional().describe("Markdown description"),
    status: name('Status name; default is the first "unstarted" status (Todo)').optional(),
    priority: priorityInput.optional(),
    assignee: assignee.optional(),
    labels: z
      .array(name("Label name"))
      .max(20)
      .optional()
      .describe("Existing label names; labels are never created on the fly"),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Due dates look like 2026-11-30.")
      .optional()
      .describe("Due date, YYYY-MM-DD"),
  }),
  create_sub_issue: z.object({
    parent: issueKey.describe("Parent issue key; the sub-issue takes its space and project"),
    title: z.string().trim().min(1).max(200).describe("Title, up to 200 characters"),
    description: z.string().max(100_000).optional().describe("Markdown description"),
    priority: priorityInput.optional(),
    assignee: assignee.optional(),
  }),
  add_comment: z.object({
    key: issueKey,
    body: z.string().min(1).max(20_000).describe("Markdown, up to 20,000 characters"),
  }),
  update_issue: z.object({
    key: issueKey,
    status: name(`New status name, like "In Progress" or "In Review"`).optional(),
    priority: priorityInput.optional(),
    assignee: assignee.optional(),
    addLabels: z.array(name("Label name")).max(20).optional().describe("Label names to add"),
    removeLabels: z.array(name("Label name")).max(20).optional().describe("Label names to remove"),
    project: name('Project name in the issue\'s space, or "none"').optional(),
  }),
};

// ---------------------------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------------------------

const json = (data: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});
const failure = (message: string): CallToolResult => ({
  content: [{ type: "text", text: message }],
  isError: true,
});

/** A ConvexError's message (what our functions raise on purpose), else null. */
function userMessage(err: unknown): string | null {
  const data = (err as { data?: unknown } | null)?.data;
  if (
    data &&
    typeof data === "object" &&
    typeof (data as { message?: unknown }).message === "string"
  ) {
    return (data as { message: string }).message;
  }
  return null;
}

type Links = { issue: (key: string) => string };
type Run<S extends z.ZodType> = (
  args: z.infer<S>,
  call: { token: string; backend: Backend; links: Links },
) => Promise<unknown>;

type ToolDef<S extends z.ZodType> = {
  title: string;
  description: string;
  readOnly: boolean;
  schema: S;
  run: Run<S>;
};

const tool = <S extends z.ZodType>(def: ToolDef<S>) => def;

export const tools = {
  get_issue: tool({
    title: "Get issue",
    description: `Read one issue by key (like ${KEY}-42): title, markdown description, status, priority, assignee, labels, space, project, parent, sub-issues and the last 50 comments. ${READ_FIRST}`,
    readOnly: true,
    schema: schemas.get_issue,
    run: async ({ key }, { token, backend, links }) => {
      const issue = await backend.query(api.mcp.getIssue, { token, key });
      return { ...issue, url: links.issue(issue.key) };
    },
  }),
  get_space_context: tool({
    title: "Get space context",
    description: `Read a space's context doc (what it is, how to work in it, conventions) and its project names. Call this first, before starting work on any issue in the space: the space is the part of the issue key before the dash (${KEY}-42 → ${KEY}).`,
    readOnly: true,
    schema: schemas.get_space_context,
    run: ({ space }, { token, backend }) =>
      backend.query(api.mcp.getSpaceContext, { token, space }),
  }),
  list_issues: tool({
    title: "List issues",
    description: `List issues, newest first. Filter by space key, project name (needs space; "none" for no project), status name, category, assignee ("me", "none" or a name), label or priority. ${READ_FIRST}`,
    readOnly: true,
    schema: schemas.list_issues,
    run: async (args, { token, backend, links }) => {
      const rows = await backend.query(
        api.mcp.listIssues,
        defined({ token, ...args, priority: toPriority(args.priority) }),
      );
      return rows.map((row) => ({ ...row, url: links.issue(row.key) }));
    },
  }),
  create_issue: tool({
    title: "Create issue",
    description: `Create an issue in a space (by key), optionally in one of its projects (by name). Status defaults to Todo; labels must already exist. Returns the new key and its link. ${READ_FIRST}`,
    readOnly: false,
    schema: schemas.create_issue,
    run: async (args, { token, backend, links }) => {
      const created = await backend.mutation(
        api.mcp.createIssue,
        defined({ token, ...args, priority: toPriority(args.priority) }),
      );
      return { ...created, url: links.issue(created.key) };
    },
  }),
  create_sub_issue: tool({
    title: "Create sub-issue",
    description: `Add a sub-issue under a parent issue, for follow-ups and split-out work. It takes the parent's space and project. Sub-issues are one level deep, so the parent can't be a sub-issue itself. ${READ_FIRST}`,
    readOnly: false,
    schema: schemas.create_sub_issue,
    run: async (args, { token, backend, links }) => {
      const created = await backend.mutation(
        api.mcp.createSubIssue,
        defined({ token, ...args, priority: toPriority(args.priority) }),
      );
      return { ...created, url: links.issue(created.key) };
    },
  }),
  add_comment: tool({
    title: "Add comment",
    description: `Comment on an issue in markdown: progress notes, findings, questions, handoffs. It shows under the token owner's name, tagged "via MCP". ${READ_FIRST}`,
    readOnly: false,
    schema: schemas.add_comment,
    run: async ({ key, body }, { token, backend, links }) => {
      const result = await backend.mutation(api.mcp.addComment, { token, key, body });
      return {
        key: result.key,
        commentId: result.commentId,
        url: `${links.issue(result.key)}#comment-${result.commentId}`,
      };
    },
  }),
  update_issue: tool({
    title: "Update issue",
    description: `Change an issue's status (by name, like "In Progress" or "In Review"), priority, assignee, labels (add or remove by name) or project (by name, or "none"). Give at least one. Nothing changes status automatically: move the issue yourself when you start and when you finish. ${READ_FIRST}`,
    readOnly: false,
    schema: schemas.update_issue,
    run: async (args, { token, backend, links }) => {
      const row = await backend.mutation(
        api.mcp.updateIssue,
        defined({ token, ...args, priority: toPriority(args.priority) }),
      );
      return { ...row, url: links.issue(row.key) };
    },
  }),
};

export type ToolName = keyof typeof tools;

/**
 * Registers every tool on `server`. Each call reads the token and the instance URL from
 * `ctx.http.authInfo` (set by `withMcpAuth` + `createVerifyToken`) and passes the raw token to Convex,
 * which re-checks it: the Convex functions are public.
 */
export function registerTools(server: McpServer, { backend }: { backend: Backend }) {
  for (const [toolName, def] of Object.entries(tools) as [ToolName, ToolDef<z.ZodType>][]) {
    server.registerTool(
      toolName,
      {
        title: def.title,
        description: def.description,
        inputSchema: def.schema,
        annotations: { readOnlyHint: def.readOnly, destructiveHint: false, openWorldHint: false },
      },
      async (args: unknown, ctx: ServerContext): Promise<CallToolResult> => {
        const auth = ctx.http?.authInfo;
        const extra = auth?.extra as PantryAuthExtra | undefined;
        if (!auth?.token || !extra)
          return failure(`Send your ${brand.name} API token as "Authorization: Bearer <token>".`);
        const links: Links = {
          issue: (key) => `${extra.appUrl}/issues/${encodeURIComponent(key)}`,
        };
        try {
          return json(await def.run(args, { token: auth.token, backend, links }));
        } catch (err) {
          const message = userMessage(err);
          if (message) return failure(message);
          console.error(`MCP tool ${toolName} failed:`, err);
          return failure(
            `${brand.name} couldn't complete ${toolName} because of a server error. Try again in a moment.`,
          );
        }
      },
    );
  }
}
