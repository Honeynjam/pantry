import { describe, expect, it } from "vitest";
import { claudeCodeSnippet, cursorEnvSnippet, cursorSnippet, mcpUrl } from "./mcp-snippets";

describe("MCP client snippets", () => {
  const url = mcpUrl("https://pantry.example.com/");

  it("point at /api/mcp on this instance", () => {
    expect(url).toBe("https://pantry.example.com/api/mcp");
  });

  it("Claude Code: claude mcp add with the bearer header", () => {
    expect(claudeCodeSnippet(url, "pan_abc")).toBe(
      'claude mcp add --transport http pantry https://pantry.example.com/api/mcp --header "Authorization: Bearer pan_abc"',
    );
    expect(claudeCodeSnippet(url)).toContain("Bearer <your-token>");
  });

  it("Cursor: mcp.json with url and a header read from the environment", () => {
    expect(JSON.parse(cursorSnippet(url))).toEqual({
      mcpServers: { pantry: { url, headers: { Authorization: "Bearer ${env:PANTRY_TOKEN}" } } },
    });
    expect(cursorEnvSnippet("pan_abc")).toBe("export PANTRY_TOKEN=pan_abc");
  });
});
