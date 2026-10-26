import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { setupTest } from "./test.setup";

const owner = { subject: "user-owner", name: "Kris", email: "kris@example.com" };
const stranger = { subject: "user-stranger", name: "Stranger", email: "stranger@example.com" };

describe("space avatars", () => {
  it("keeps the avatar chosen at creation, and none when it's left out", async () => {
    const t = setupTest();
    const as = t.withIdentity(owner);
    await as.mutation(api.setup.createWorkspace, { workspaceName: "Home" });
    const avatar = { shape: "jam", color: "red", expression: "happy" } as const;
    const { spaceId } = await as.mutation(api.spaces.create, { name: "Website", key: "WEB", avatar });
    const { spaceId: plainId } = await as.mutation(api.spaces.create, { name: "Infra", key: "OPS" });
    expect((await t.run((ctx) => ctx.db.get("spaces", spaceId)))?.avatar).toEqual(avatar);
    expect((await t.run((ctx) => ctx.db.get("spaces", plainId)))?.avatar).toBeUndefined();
  });

  it("changes the avatar later", async () => {
    const t = setupTest();
    const as = t.withIdentity(owner);
    const { spaceId } = await as.mutation(api.setup.createWorkspace, {});
    const avatar = { shape: "cookie", color: "teal", expression: "wink" } as const;
    await as.mutation(api.spaces.setAvatar, { spaceId, avatar });
    const current = await as.query(api.workspace.current, {});
    expect(current.spaces[0]?.avatar).toEqual(avatar);
  });

  it("rejects unknown shapes and other workspaces' spaces", async () => {
    const t = setupTest();
    const { spaceId } = await t.withIdentity(owner).mutation(api.setup.createWorkspace, {});
    await t.run(async (ctx) => {
      const workspaceId = await ctx.db.insert("workspaces", {
        name: "Elsewhere",
        slug: "elsewhere",
        createdBy: stranger.subject,
      });
      await ctx.db.insert("members", { workspaceId, userId: stranger.subject, displayName: "Stranger", role: "owner" });
    });
    const avatar = { shape: "toast", color: "blue", expression: "dots" } as const;
    await expect(
      t.withIdentity(owner).mutation(api.spaces.setAvatar, {
        spaceId,
        avatar: { ...avatar, shape: "pizza" as "toast" },
      }),
    ).rejects.toThrow();
    await expect(t.withIdentity(stranger).mutation(api.spaces.setAvatar, { spaceId, avatar })).rejects.toThrow(
      /not found/i,
    );
  });
});
