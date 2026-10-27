import { describe, expect, it, vi } from "vitest";
import { verifyOneTimeTokenFromUrl, type CrossDomainAuthActions } from "./cross-domain";

function fakeClient(verifyResult: unknown | Error) {
  return {
    crossDomain: {
      oneTimeToken: {
        verify: vi.fn(async () => {
          if (verifyResult instanceof Error) throw verifyResult;
          return verifyResult as { data?: { session?: { token: string } } };
        }),
      },
    },
    getSession: vi.fn(async () => ({})),
    updateSession: vi.fn(),
  } satisfies CrossDomainAuthActions;
}

const history = () => ({ state: { keep: true }, replaceState: vi.fn() });

describe("verifyOneTimeTokenFromUrl", () => {
  it("does nothing without ?ott=", async () => {
    const client = fakeClient({});
    const h = history();
    expect(
      await verifyOneTimeTokenFromUrl(client, { href: "tauri://localhost/index.html" }, h),
    ).toBe(false);
    expect(client.crossDomain.oneTimeToken.verify).not.toHaveBeenCalled();
    expect(h.replaceState).not.toHaveBeenCalled();
  });

  it("strips the token, verifies it, loads the session with it and refreshes the store", async () => {
    const client = fakeClient({ data: { session: { token: "session-token" } } });
    const h = history();
    const ok = await verifyOneTimeTokenFromUrl(
      client,
      { href: "tauri://localhost/index.html?ott=abc&x=1" },
      h,
    );
    expect(ok).toBe(true);
    expect(h.replaceState).toHaveBeenCalledWith(
      { keep: true },
      "",
      "tauri://localhost/index.html?x=1",
    );
    expect(client.crossDomain.oneTimeToken.verify).toHaveBeenCalledWith({ token: "abc" });
    expect(client.getSession).toHaveBeenCalledWith({
      fetchOptions: { headers: { Authorization: "Bearer session-token" } },
    });
    expect(client.updateSession).toHaveBeenCalledTimes(1);
  });

  it("still strips the token when verification fails, and changes nothing else", async () => {
    for (const outcome of [new Error("expired"), { data: null }, null]) {
      const client = fakeClient(outcome);
      const h = history();
      expect(
        await verifyOneTimeTokenFromUrl(client, { href: "http://localhost:3218/?ott=used" }, h),
      ).toBe(false);
      expect(h.replaceState).toHaveBeenCalledWith({ keep: true }, "", "http://localhost:3218/");
      expect(client.getSession).not.toHaveBeenCalled();
      expect(client.updateSession).not.toHaveBeenCalled();
    }
  });
});
