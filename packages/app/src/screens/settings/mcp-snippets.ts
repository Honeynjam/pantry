import { brand } from "@pantry/backend/brand";

/**
 * What the API tokens screen tells people to paste (spec §10b, client docs checked 26 Oct 2026):
 * Claude Code takes a header on `claude mcp add`; Cursor's mcp.json takes `url` + `headers`, with the
 * token read from an environment variable so it stays out of the file.
 */

/** The server name clients register us under, e.g. "pantry". */
export const MCP_SERVER_NAME = brand.name.toLowerCase();

/** The environment variable the Cursor snippet reads, e.g. PANTRY_TOKEN. */
export const TOKEN_ENV_VAR = `${brand.name.toUpperCase()}_TOKEN`;

/** Shown in the snippets until a token has just been created on this screen. */
export const TOKEN_PLACEHOLDER = "<your-token>";

/** The MCP endpoint of the instance the app is served from. */
export const mcpUrl = (origin: string) => `${origin.replace(/\/+$/, "")}/api/mcp`;

export function claudeCodeSnippet(url: string, token = TOKEN_PLACEHOLDER) {
  return `claude mcp add --transport http ${MCP_SERVER_NAME} ${url} --header "Authorization: Bearer ${token}"`;
}

export function cursorSnippet(url: string) {
  return JSON.stringify(
    {
      mcpServers: {
        [MCP_SERVER_NAME]: { url, headers: { Authorization: `Bearer \${env:${TOKEN_ENV_VAR}}` } },
      },
    },
    null,
    2,
  );
}

export function cursorEnvSnippet(token = TOKEN_PLACEHOLDER) {
  return `export ${TOKEN_ENV_VAR}=${token}`;
}
