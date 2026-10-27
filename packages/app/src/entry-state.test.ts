import { describe, expect, it } from "vitest";
import { deriveEntryState, type SetupStatus } from "./entry-state";

const auth = (isAuthenticated: boolean, isLoading = false) => ({ isAuthenticated, isLoading });
const status = (s: Partial<SetupStatus>): SetupStatus => ({
  needsSetup: false,
  needsSecret: false,
  signedIn: false,
  isMember: false,
  ...s,
});

describe("deriveEntryState", () => {
  it("waits for auth and for the status query", () => {
    expect(deriveEntryState(auth(false, true), undefined)).toEqual({
      kind: "loading",
      reason: "auth",
    });
    expect(deriveEntryState(auth(false), undefined)).toEqual({ kind: "loading", reason: "status" });
  });

  it("shows the secret fix before anything else, even while auth is loading", () => {
    expect(
      deriveEntryState(auth(false, true), status({ needsSecret: true, needsSetup: true })),
    ).toEqual({
      kind: "needs-secret",
    });
  });

  it("covers first-run setup, signed out and signed in", () => {
    expect(deriveEntryState(auth(false), status({ needsSetup: true }))).toEqual({
      kind: "needs-setup",
      signedIn: false,
    });
    expect(deriveEntryState(auth(true), status({ needsSetup: true, signedIn: true }))).toEqual({
      kind: "needs-setup",
      signedIn: true,
    });
  });

  describe("transitions where the status result lags the client's auth", () => {
    it("sign-up/sign-in: client authenticated, status still from before → loading, then settles", () => {
      expect(deriveEntryState(auth(true), status({ needsSetup: true, signedIn: false }))).toEqual({
        kind: "loading",
        reason: "auth-status-mismatch",
      });
      expect(
        deriveEntryState(auth(true), status({ needsSetup: true, signedIn: true })),
      ).toMatchObject({
        kind: "needs-setup",
      });
    });

    it("workspace created: needsSetup flips with isMember in one result → ready", () => {
      expect(
        deriveEntryState(auth(true), status({ needsSetup: false, signedIn: true, isMember: true })),
      ).toEqual({ kind: "ready" });
    });

    it("sign-out: client signed out, status still says signed in → loading, then signed-out", () => {
      expect(
        deriveEntryState(auth(false), status({ signedIn: true, isMember: true })),
      ).toMatchObject({
        kind: "loading",
      });
      expect(deriveEntryState(auth(false), status({ signedIn: false }))).toEqual({
        kind: "signed-out",
      });
    });

    it("Convex auth failed while a session exists: both report signed out → signed-out, not loading", () => {
      expect(deriveEntryState(auth(false), status({ signedIn: false }))).toEqual({
        kind: "signed-out",
      });
    });
  });

  it("tells members from signed-in strangers", () => {
    expect(deriveEntryState(auth(true), status({ signedIn: true, isMember: false }))).toEqual({
      kind: "not-member",
    });
    expect(deriveEntryState(auth(true), status({ signedIn: true, isMember: true }))).toEqual({
      kind: "ready",
    });
  });
});
