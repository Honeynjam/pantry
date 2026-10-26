import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { ConvexError } from "convex/values";
import { getFunctionName } from "convex/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PantryAuthExtra } from "./auth";
import type { Backend } from "./backend";
import { registerTools, SERVER_INSTRUCTIONS, type ToolName } from "./tools";

const TOKEN = "pan_test-token";
const extra: PantryAuthExtra = {
  tokenId: "token1",
  memberId: "member1",
  workspaceId: "ws1",
  userId: "user1",
  displayName: "Kris",
  appUrl: "https://pantry.example.com",
};
const stubAuth: AuthInfo = { token: TOKEN, clientId: "token1", scopes: [], extra };

type Call = { fn: string; args: Record<string, unknown> };

/** A fake Convex: answers by function name ("mcp:getIssue") and records every call. */
function fakeBackend(answers: Record<string, (args: Record<string, unknown>) => unknown>) {
  const calls: Call[] = [];
  const answer = async (fn: Parameters<Backend["query"]>[0], args: Record<string, unknown>) => {
    const name = getFunctionName(fn);
    calls.push({ fn: name, args });
    const handler = answers[name];
    if (!handler) throw new Error(`unexpected call to ${name}`);
    return handler(args);
  };
  const backend = { query: answer, mutation: answer } as unknown as Backend;
  return { backend, calls };
}

/** A real MCP client talking to the real handler in-process, with the stub authInfo. */
async function connect(backend: Backend, auth: AuthInfo | null = stubAuth) {
  const handler = withMcpAuth(
    createMcpHandler((server) => registerTools(server, { backend }), {
      serverInfo: { name: "Pantry", version: "0.0.0" },
      instructions: SERVER_INSTRUCTIONS,
    }),
    async () => auth ?? undefined,
    { required: true },
  );
  const client = new Client({ name: "test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL("https://pantry.example.com/api/mcp"), {
    fetch: (url, init) => handler(new Request(url, init)),
  });
  await client.connect(transport);
  return client;
}

async function call(client: Client, name: ToolName, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as { type: string; text: string }[])[0]!.text;
  return { isError: result.isError === true, text, json: () => JSON.parse(text) as Record<string, unknown> };
}

const userError = (message: string) => new ConvexError({ code: "UNKNOWN_STATUS", message });

describe("tools/list", () => {
  it("lists the seven tools, each telling the agent to read the space context first", async () => {
    const client = await connect(fakeBackend({}).backend);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "add_comment",
      "create_issue",
      "create_sub_issue",
      "get_issue",
      "get_space_context",
      "list_issues",
      "update_issue",
    ]);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.description).toMatch(tool.name === "get_space_context" ? /Call this first/ : /Call get_space_context/);
    }
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
    expect(byName.get_issue!.annotations?.readOnlyHint).toBe(true);
    expect(byName.update_issue!.annotations?.readOnlyHint).toBe(false);
    expect(Object.keys(byName.create_issue!.inputSchema.properties ?? {})).toEqual([
      "space",
      "project",
      "title",
      "description",
      "status",
      "priority",
      "assignee",
      "labels",
      "dueDate",
    ]);
    expect(byName.create_issue!.inputSchema.required).toEqual(["space", "title"]);
    expect(client.getInstructions()).toMatch(/call get_issue and then get_space_context/);
  });
});

describe("each tool passes the token to its Convex function", () => {
  it("get_issue", async () => {
    const { backend, calls } = fakeBackend({ "mcp:getIssue": () => ({ key: "PAN-42", title: "Fix it" }) });
    const result = await call(await connect(backend), "get_issue", { key: "pan-42" });
    expect(calls).toEqual([{ fn: "mcp:getIssue", args: { token: TOKEN, key: "PAN-42" } }]);
    expect(result.json()).toEqual({ key: "PAN-42", title: "Fix it", url: "https://pantry.example.com/issues/PAN-42" });
  });

  it("get_space_context", async () => {
    const context = { space: { key: "PAN", name: "Pantry", kind: "product" }, projects: [], context: "# Hi", updatedAt: null, updatedBy: null };
    const { backend, calls } = fakeBackend({ "mcp:getSpaceContext": () => context });
    const result = await call(await connect(backend), "get_space_context", { space: " PAN " });
    expect(calls).toEqual([{ fn: "mcp:getSpaceContext", args: { token: TOKEN, space: "PAN" } }]);
    expect(result.json()).toEqual(context);
  });

  it("list_issues, with priority names turned into numbers and unset filters left out", async () => {
    const { backend, calls } = fakeBackend({ "mcp:listIssues": () => [{ key: "PAN-1" }, { key: "WEB-2" }] });
    const result = await call(await connect(backend), "list_issues", { space: "PAN", assignee: "me", priority: "urgent", limit: 5 });
    expect(calls).toEqual([
      { fn: "mcp:listIssues", args: { token: TOKEN, space: "PAN", assignee: "me", priority: 1, limit: 5 } },
    ]);
    expect(result.json()).toEqual([
      { key: "PAN-1", url: "https://pantry.example.com/issues/PAN-1" },
      { key: "WEB-2", url: "https://pantry.example.com/issues/WEB-2" },
    ]);
  });

  it("create_issue", async () => {
    const { backend, calls } = fakeBackend({ "mcp:createIssue": () => ({ key: "PAN-7", space: "PAN", project: "Launch" }) });
    const args = { space: "PAN", project: "Launch", title: "New", labels: ["Bug"], priority: 3, dueDate: "2026-11-30" };
    const result = await call(await connect(backend), "create_issue", args);
    expect(calls).toEqual([{ fn: "mcp:createIssue", args: { token: TOKEN, ...args } }]);
    expect(result.json()).toEqual({ key: "PAN-7", space: "PAN", project: "Launch", url: "https://pantry.example.com/issues/PAN-7" });
  });

  it("create_sub_issue", async () => {
    const { backend, calls } = fakeBackend({
      "mcp:createSubIssue": () => ({ key: "PAN-8", parent: "PAN-7", space: "PAN", project: "Launch" }),
    });
    const result = await call(await connect(backend), "create_sub_issue", { parent: "PAN-7", title: "Child", priority: "low" });
    expect(calls).toEqual([{ fn: "mcp:createSubIssue", args: { token: TOKEN, parent: "PAN-7", title: "Child", priority: 4 } }]);
    expect(result.json()).toMatchObject({ key: "PAN-8", parent: "PAN-7", url: "https://pantry.example.com/issues/PAN-8" });
  });

  it("add_comment", async () => {
    const { backend, calls } = fakeBackend({ "mcp:addComment": () => ({ key: "PAN-7", commentId: "c1" }) });
    const result = await call(await connect(backend), "add_comment", { key: "PAN-7", body: "Done **step 1**." });
    expect(calls).toEqual([{ fn: "mcp:addComment", args: { token: TOKEN, key: "PAN-7", body: "Done **step 1**." } }]);
    expect(result.json()).toEqual({ key: "PAN-7", commentId: "c1", url: "https://pantry.example.com/issues/PAN-7#comment-c1" });
  });

  it("update_issue", async () => {
    const { backend, calls } = fakeBackend({ "mcp:updateIssue": () => ({ key: "PAN-7", status: "In Review" }) });
    const result = await call(await connect(backend), "update_issue", { key: "PAN-7", status: "In Review", removeLabels: ["Bug"] });
    expect(calls).toEqual([
      { fn: "mcp:updateIssue", args: { token: TOKEN, key: "PAN-7", status: "In Review", removeLabels: ["Bug"] } },
    ]);
    expect(result.json()).toEqual({ key: "PAN-7", status: "In Review", url: "https://pantry.example.com/issues/PAN-7" });
  });
});

describe("errors", () => {
  afterEach(() => vi.restoreAllMocks());

  it("a refusal from Convex comes back as isError with its valid-values message", async () => {
    const message = 'No status "Doing". Statuses: "Backlog", "Todo", "In Progress", "In Review", "Done", "Canceled".';
    const { backend } = fakeBackend({
      "mcp:updateIssue": () => {
        throw userError(message);
      },
    });
    const result = await call(await connect(backend), "update_issue", { key: "PAN-7", status: "Doing" });
    expect(result).toMatchObject({ isError: true, text: message });
  });

  it("bad input is refused before Convex is called", async () => {
    const { backend, calls } = fakeBackend({});
    const client = await connect(backend);
    for (const [name, args] of [
      ["get_issue", { key: "PAN42" }],
      ["create_issue", { space: "PAN", title: "" }],
      ["create_issue", { space: "PAN", title: "x", priority: "highest" }],
      ["add_comment", { key: "PAN-1", body: "" }],
      ["list_issues", { limit: 500 }],
    ] as const) {
      const result = await call(client, name, args);
      expect(result.isError, `${name} ${JSON.stringify(args)}`).toBe(true);
    }
    expect(calls).toEqual([]);
  });

  it("an unexpected server error is reported without its internals", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { backend } = fakeBackend({
      "mcp:getIssue": () => {
        throw new Error("[Request ID: abc] Server Error");
      },
    });
    const result = await call(await connect(backend), "get_issue", { key: "PAN-1" });
    expect(result.isError).toBe(true);
    expect(result.text).toBe("Pantry couldn't complete get_issue because of a server error. Try again in a moment.");
  });

  it("a request without a token gets 401 from withMcpAuth", async () => {
    const { backend } = fakeBackend({});
    await expect(connect(backend, null)).rejects.toThrow(/401|nauthorized|No authorization/i);
  });
});
