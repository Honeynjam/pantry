import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { APIError } from "better-auth/api";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { env, internalQuery } from "./_generated/server";
import authConfig from "./auth.config";
import { checkSignUp, type SignUpCheck } from "./lib/signup";

export const MISSING_SECRET_MESSAGE = "Missing BETTER_AUTH_SECRET, see setup screen";

export const authComponent = createClient<DataModel>(components.betterAuth);

/** Internal: lets the Better Auth hook check the guard from an HTTP action (no ctx.db there). */
export const canSignUp = internalQuery({
  args: { email: v.string() },
  handler: (ctx, { email }): Promise<SignUpCheck> => checkSignUp(ctx, email, Date.now()),
});

async function runSignUpCheck(ctx: GenericCtx<DataModel>, email: string): Promise<SignUpCheck> {
  if ("db" in ctx) return checkSignUp(ctx, email, Date.now());
  return ctx.runQuery(internal.auth.canSignUp, { email });
}

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = env.SITE_URL;
  return {
    appName: undefined,
    baseURL: siteUrl,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: siteUrl ? [siteUrl] : [],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
    },
    databaseHooks: {
      user: {
        create: {
          // Invite-only sign-up, enforced on the server (spec §10b).
          before: async (user) => {
            const check = await runSignUpCheck(ctx, user.email);
            if (!check.allowed) {
              throw new APIError("FORBIDDEN", {
                message: "Sign-up is invite-only. Ask the workspace owner for an invite link.",
              });
            }
            return { data: user };
          },
        },
      },
    },
    plugins: [convex({ authConfig })],
  } satisfies BetterAuthOptions;
};

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  if (!env.BETTER_AUTH_SECRET) {
    throw new Error(MISSING_SECRET_MESSAGE);
  }
  return betterAuth(createAuthOptions(ctx));
};
