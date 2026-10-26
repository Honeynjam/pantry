"use client";

import { api } from "@pantry/backend/api";
import { Button } from "@pantry/ui/components/button";
import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { useAuthClient } from "../providers";
import { AuthLayout } from "./auth-layout";
import { describeError, FormError } from "./form-error";

/** `?invite=` on the sign-up and sign-in pages. */
export const withInvite = (path: string, token: string | undefined) =>
  token ? `${path}?invite=${encodeURIComponent(token)}` : path;

/**
 * Signed in but not a member yet, with an invite token: accept it. On success the entry gate sees
 * the new member row and moves on to the workspace. Accepting twice is a no-op on the server.
 */
export function AcceptInvite({ token }: { token: string }) {
  const accept = useMutation(api.invites.accept);
  const authClient = useAuthClient();
  const session = authClient.useSession();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    accept({ token }).catch((err: unknown) => {
      if (!cancelled) setError(describeError(err, "Couldn't accept the invite. Ask the owner for a new link."));
    });
    return () => {
      cancelled = true;
    };
  }, [accept, token]);

  if (!error) {
    return (
      <AuthLayout title="Joining the workspace…">
        <p className="text-center text-sm text-muted-foreground" aria-busy="true">
          Setting up your access. One moment.
        </p>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout
      title="Couldn't join"
      description={<>Signed in as {session.data?.user.email ?? "this account"}.</>}
    >
      <div className="flex flex-col gap-4">
        <FormError message={error} />
        <Button variant="secondary" className="w-full" onClick={() => void authClient.signOut()}>
          Sign out
        </Button>
      </div>
    </AuthLayout>
  );
}
