import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const via = v.union(v.literal("app"), v.literal("mcp"));
export const category = v.union(
  v.literal("backlog"), v.literal("unstarted"), v.literal("started"),
  v.literal("review"), v.literal("done"), v.literal("canceled"),
);
// 0 none, 1 urgent, 2 high, 3 medium, 4 low (Linear's order)
export const priority = v.union(v.literal(0), v.literal(1), v.literal(2), v.literal(3), v.literal(4));
export const spaceKind = v.union(v.literal("product"), v.literal("client"));

export default defineSchema({
  workspaces: defineTable({ name: v.string(), slug: v.string(), createdBy: v.string() })
    .index("by_slug", ["slug"]),

  members: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.string(), // Better Auth user id (lives in the component, so a string)
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
    role: v.union(v.literal("owner"), v.literal("member")),
  })
    // Kept next to by_workspace_and_user (spec §10b): lists members in join order.
    // eslint-disable-next-line @convex-dev/no-duplicate-indexes
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_workspace_and_user", ["workspaceId", "userId"]),

  invites: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(), // lower-cased
    tokenHash: v.string(),
    createdBy: v.id("members"),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_email", ["email"])
    .index("by_workspace", ["workspaceId"]),

  // A product or a client (spec §5): owns the issue key, the counter, the context doc and the views.
  spaces: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    key: v.string(), // ^[A-Z][A-Z0-9]{1,9}$, fixed after creation in v0.1
    nextIssueNumber: v.number(),
    archivedAt: v.optional(v.number()),
    kind: v.optional(spaceKind), // "product" when missing
  })
    // Kept next to by_workspace_and_key (spec §10b): lists spaces in creation order.
    // eslint-disable-next-line @convex-dev/no-duplicate-indexes
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_key", ["workspaceId", "key"]),

  // An optional workstream inside a space ("LinkedIn", "Launch"). An issue is in at most one.
  projects: defineTable({
    workspaceId: v.id("workspaces"),
    spaceId: v.id("spaces"),
    name: v.string(), // unique per space among active projects, ignoring case
    color: v.optional(v.string()),
    sortOrder: v.number(),
    archivedAt: v.optional(v.number()),
  })
    // Kept next to by_space_and_name (spec §10b): a space's projects, sorted by sortOrder in code.
    // eslint-disable-next-line @convex-dev/no-duplicate-indexes
    .index("by_space", ["spaceId"])
    .index("by_space_and_name", ["spaceId", "name"]),

  statuses: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    category, // fixed after creation; name, colour and order are editable
    order: v.number(),
    color: v.string(),
  }).index("by_workspace_and_order", ["workspaceId", "order"]),

  labels: defineTable({ workspaceId: v.id("workspaces"), name: v.string(), color: v.string() })
    .index("by_workspace", ["workspaceId"]),

  issues: defineTable({
    workspaceId: v.id("workspaces"),
    spaceId: v.id("spaces"),
    projectId: v.optional(v.id("projects")), // must be in the issue's space
    number: v.number(),
    key: v.string(), // "PAN-42"
    title: v.string(),
    description: v.string(), // markdown, "" when empty
    statusId: v.id("statuses"),
    statusCategory: category, // copied from the status for fast category filters
    priority,
    assigneeId: v.optional(v.id("members")),
    creatorId: v.id("members"),
    labelIds: v.array(v.id("labels")),
    parentId: v.optional(v.id("issues")), // one level only
    dueDate: v.optional(v.string()), // "YYYY-MM-DD"
    sortOrder: v.number(), // fractional: new = midpoint of neighbours
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_space_and_status", ["spaceId", "statusId", "sortOrder"])
    .index("by_project", ["projectId"])
    .index("by_assignee_and_category", ["assigneeId", "statusCategory"])
    .index("by_parent", ["parentId"])
    .index("by_workspace_and_key", ["workspaceId", "key"])
    .index("by_workspace_and_updated", ["workspaceId", "updatedAt"])
    .searchIndex("search_title", { searchField: "title", filterFields: ["workspaceId", "spaceId", "projectId"] }),

  comments: defineTable({
    issueId: v.id("issues"),
    authorId: v.id("members"),
    body: v.string(),
    via,
    editedAt: v.optional(v.number()),
  }).index("by_issue", ["issueId"]),

  activity: defineTable({
    workspaceId: v.id("workspaces"),
    issueId: v.id("issues"),
    actorId: v.optional(v.id("members")),
    type: v.union(
      v.literal("created"), v.literal("status_changed"), v.literal("priority_changed"),
      v.literal("assigned"), v.literal("labels_changed"), v.literal("commented"),
      v.literal("title_changed"), v.literal("description_changed"), v.literal("parent_changed"),
      v.literal("due_date_changed"), v.literal("project_changed"),
    ),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    via,
  })
    .index("by_issue", ["issueId"])
    .index("by_workspace", ["workspaceId"]),

  docs: defineTable({
    workspaceId: v.id("workspaces"),
    spaceId: v.optional(v.id("spaces")),
    kind: v.literal("space_context"), // widen to "doc" later
    title: v.string(),
    body: v.string(),
    updatedBy: v.id("members"),
    updatedAt: v.number(),
  }).index("by_space_and_kind", ["spaceId", "kind"]),

  apiTokens: defineTable({
    userId: v.string(),
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    name: v.string(),
    tokenPrefix: v.string(), // first 8 chars, e.g. "pan_x7Kq", shown in the UI
    tokenHash: v.string(), // SHA-256 hex
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_user", ["userId"]),
});
