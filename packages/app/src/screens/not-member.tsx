"use client";

import { Button } from "@pantry/ui/components/button";
import { useAuthClient } from "../providers";
import { AuthLayout } from "./auth-layout";

/** Signed in, but this account has no member row (e.g. it signed up while someone else set up). */
export function NotMemberScreen() {
  const authClient = useAuthClient();
  const session = authClient.useSession();
  return (
    <AuthLayout
      title="No access yet"
      description={
        <>
          {session.data?.user.email ?? "This account"} isn&apos;t a member of this workspace. Ask the owner for an invite
          link, then sign in again.
        </>
      }
    >
      <Button variant="secondary" className="w-full" onClick={() => void authClient.signOut()}>
        Sign out
      </Button>
    </AuthLayout>
  );
}
