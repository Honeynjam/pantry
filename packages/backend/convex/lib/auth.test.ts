import { describe, expect, it } from "vitest";
import { setupTest } from "../test.setup";
import { requireMember } from "./auth";

describe("requireMember", () => {
  it("throws when signed out", async () => {
    const t = setupTest();
    await expect(t.run((ctx) => requireMember(ctx))).rejects.toThrow(/Sign in first/);
  });

  it("throws when the user has no member row", async () => {
    const t = setupTest();
    const asUser = t.withIdentity({ subject: "user-without-member" });
    await expect(asUser.run((ctx) => requireMember(ctx))).rejects.toThrow(/not a member/);
  });

  it("returns the caller's member row", async () => {
    const t = setupTest();
    const memberId = await t.run(async (ctx) => {
      const workspaceId = await ctx.db.insert("workspaces", {
        name: "Home",
        slug: "home",
        createdBy: "user-1",
      });
      return ctx.db.insert("members", {
        workspaceId,
        userId: "user-1",
        displayName: "Kris",
        role: "owner",
      });
    });
    const me = await t.withIdentity({ subject: "user-1" }).run((ctx) => requireMember(ctx));
    expect(me._id).toBe(memberId);
  });
});
