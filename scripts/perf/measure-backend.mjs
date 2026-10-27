#!/usr/bin/env node
// Documents and bytes read per call for the hot queries and writes, on a LOCAL deployment seeded with
// scripts/perf/devSeed.ts. Streams `convex logs --jsonl` (its usageStats) while calling each function
// with `convex run --identity`, then prints one row per call. Writes are undone where they can be
// (move back), so before/after runs see the same data.
// Usage (from the repo root, local backend running): node scripts/perf/measure-backend.mjs [--json]
import { execFileSync, spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const cwd = new URL("../../packages/backend/", import.meta.url).pathname;
const asJson = process.argv.includes("--json");
const convex = (args, input) =>
  execFileSync("npx", ["convex", ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    input,
    maxBuffer: 1 << 28,
  });
const data = (table) =>
  convex(["data", table, "--limit", "10000", "--format", "jsonl"])
    .trim()
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line));

const [owner] = data("members").filter((member) => member.role === "owner");
const identity = JSON.stringify({ subject: owner.userId });
const spaces = Object.fromEntries(data("spaces").map((space) => [space.key, space]));
const statuses = data("statuses");
const byCategory = (category) => statuses.find((status) => status.category === category);

function run(fn, args = {}, { as = identity } = {}) {
  const out = convex(["run", ...(as ? ["--identity", as] : []), fn, JSON.stringify(args)]);
  return out.trim() ? JSON.parse(out) : null;
}

// An MCP token for the MCP tools (tokens.create is an action, so this works over `convex run`).
const token = run("tokens:create", { name: `perf ${Date.now()}` }).token;

const logs = spawn("npx", ["convex", "logs", "--jsonl", "--success"], { cwd });
const events = [];
let buffer = "";
logs.stdout.on("data", (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, index);
    buffer = buffer.slice(index + 1);
    if (line.startsWith("{")) {
      const event = JSON.parse(line);
      if (event.kind === "Completion") events.push(event);
    }
  }
});
await sleep(3000);

const calls = [];
const call = (label, fn, args, options) => {
  calls.push({ label, fn, at: events.length });
  const result = run(fn, args, options);
  calls.at(-1).returned = JSON.stringify(result ?? null).length;
  return result;
};

const pan = spaces.PAN;
call("workspace.current", "workspace:current");
const list = call("issues.listBySpace PAN", "issues:listBySpace", { spaceId: pan._id });
call("issues.listBySpace PAN includeDone", "issues:listBySpace", {
  spaceId: pan._id,
  includeDone: true,
});
call("issues.listBySpace WEB", "issues:listBySpace", { spaceId: spaces.WEB._id });
call("issues.listMine", "issues:listMine");
call("issues.get PAN-1200", "issues:get", { key: "PAN-1200" });
call("issues.search 'board'", "issues:search", { text: "board" });
call("issues.search '42'", "issues:search", { text: "42" });
call("mcp.listIssues (no filter)", "mcp:listIssues", { token, limit: 50 }, { as: null });
call(
  "mcp.listIssues space=OPS status=In Review",
  "mcp:listIssues",
  { token, space: "OPS", status: "In Review" },
  { as: null },
);
call("mcp.getIssue PAN-1200", "mcp:getIssue", { token, key: "PAN-1200" }, { as: null });

// Writes. Pick an open issue in PAN, move it to Done (the biggest column) and back.
const open = list.find((issue) => issue.statusCategory === "unstarted" && !issue.parentId);
const done = byCategory("done");
call("issues.move → Done (top)", "issues:move", { issueId: open._id, statusId: done._id });
call("issues.move → Todo (back)", "issues:move", { issueId: open._id, statusId: open.statusId });
call("issues.update priority", "issues:update", {
  issueId: open._id,
  priority: open.priority === 1 ? 2 : 1,
});
call("issues.update priority (back)", "issues:update", {
  issueId: open._id,
  priority: open.priority,
});
const probe = call("issues.create PAN (Todo)", "issues:create", {
  spaceId: pan._id,
  title: "Perf probe",
});
call(
  "mcp.updateIssue status",
  "mcp:updateIssue",
  { token, key: open.key, status: "In Progress" },
  { as: null },
);
call("issues.move → Todo (back)", "issues:move", { issueId: open._id, statusId: open.statusId });

await sleep(4000);
logs.kill();
run("issues:remove", { issueId: probe.issueId });

const rows = calls.map((entry) => {
  const event = events
    .slice(entry.at)
    .find((candidate) => candidate.identifier === entry.fn && !candidate.used);
  if (event) event.used = true;
  const usage = event?.usageStats ?? {};
  return {
    call: entry.label + (event?.cachedResult ? " (cached)" : ""),
    docsRead: usage.databaseReadDocuments,
    kbRead:
      usage.databaseReadBytes !== undefined
        ? +(usage.databaseReadBytes / 1024).toFixed(1)
        : undefined,
    kbReturned: +(entry.returned / 1024).toFixed(1),
    ms: event ? +(event.executionTime * 1000).toFixed(1) : undefined,
  };
});
run("tokens:revoke", {
  tokenId: run("tokens:list").find((row) => row.name.startsWith("perf ") && !row.revokedAt)?._id,
});

if (asJson) console.log(JSON.stringify(rows, null, 2));
else {
  console.log(
    "call".padEnd(44),
    "docs".padStart(6),
    "kB read".padStart(9),
    "kB out".padStart(8),
    "ms".padStart(7),
  );
  for (const row of rows) {
    console.log(
      row.call.padEnd(44),
      String(row.docsRead ?? "?").padStart(6),
      String(row.kbRead ?? "?").padStart(9),
      String(row.kbReturned).padStart(8),
      String(row.ms ?? "?").padStart(7),
    );
  }
}
