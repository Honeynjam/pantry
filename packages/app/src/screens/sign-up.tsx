"use client";

import { api } from "@pantry/backend/api";
import { Button } from "@pantry/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@pantry/ui/components/field";
import { Input } from "@pantry/ui/components/input";
import { useQuery } from "convex/react";
import { CircleSlashIcon, LockIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { EntryGate } from "../entry";
import { routes, useNavigation } from "../navigation";
import { useAuthClient } from "../providers";
import { AuthLayout } from "./auth-layout";
import { AcceptInvite, withInvite } from "./accept-invite";
import { describeError, FormError } from "./form-error";
import { SlowHint } from "./slow-hint";

const SIGNED_OUT = ["signed-out"] as const;
const SIGNED_OUT_OR_JOINING = ["signed-out", "not-member"] as const;

/**
 * Invite-only sign-up. The server rejects emails without a pending invite. With `?invite=`, the
 * invite is accepted right after the account exists.
 */
export function SignUpPage({ inviteToken }: { inviteToken?: string }) {
  if (!inviteToken) return <EntryGate allow={SIGNED_OUT}>{() => <SignUpForm />}</EntryGate>;
  return (
    <EntryGate allow={SIGNED_OUT_OR_JOINING}>
      {(state) =>
        state.kind === "not-member" ? <AcceptInvite token={inviteToken} /> : <InviteSignUp token={inviteToken} />
      }
    </EntryGate>
  );
}

/**
 * The invite link's sign-up: `invites.peek` gives the invited email (pre-filled and locked) and the
 * workspace name, or says why the link no longer works. The pre-fill is only a convenience: the
 * server checks the email again at sign-up and when the invite is accepted.
 */
function InviteSignUp({ token }: { token: string }) {
  const invite = useQuery(api.invites.peek, { token });
  if (invite === undefined) {
    return (
      <AuthLayout title="Checking your invite…">
        <p className="text-center text-sm text-muted-foreground" aria-busy="true">
          One moment.
        </p>
      </AuthLayout>
    );
  }
  if (invite.status !== "valid" || !invite.email) return <InviteProblem token={token} status={invite.status} />;
  return <SignUpForm inviteToken={token} invitedEmail={invite.email} workspaceName={invite.workspaceName} />;
}

const PROBLEM: Record<"expired" | "revoked" | "used" | "unknown" | "valid", { title: string; body: string }> = {
  expired: {
    title: "This invite has expired",
    body: "Invite links work for 7 days. Ask the person who invited you for a new one.",
  },
  revoked: {
    title: "This invite was revoked",
    body: "The workspace owner cancelled this link. Ask them for a new one if you should still join.",
  },
  used: {
    title: "This invite has already been used",
    body: "Each link works once. If you joined with it, sign in instead.",
  },
  unknown: {
    title: "This invite link isn't valid",
    body: "Check that you copied the whole link, or ask the workspace owner for a new one.",
  },
  // Not shown (a valid link renders the form); here so the map covers every status.
  valid: { title: "This invite can't be used", body: "Ask the workspace owner for a new link." },
};

function InviteProblem({ token, status }: { token: string; status: keyof typeof PROBLEM }) {
  const { Link } = useNavigation();
  const problem = PROBLEM[status];
  return (
    <AuthLayout
      title={problem.title}
      footer={
        <>
          Already have an account?{" "}
          <Link href={withInvite(routes.signIn, status === "used" ? undefined : token)} className="text-foreground underline decoration-gray-8 underline-offset-4 hover:decoration-current">
            Sign in
          </Link>
        </>
      }
    >
      <div role="status" className="flex flex-col items-center gap-3 text-center">
        <CircleSlashIcon className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{problem.body}</p>
      </div>
    </AuthLayout>
  );
}

function SignUpForm({
  inviteToken,
  invitedEmail,
  workspaceName,
}: {
  inviteToken?: string;
  invitedEmail?: string;
  workspaceName?: string | null;
}) {
  const authClient = useAuthClient();
  const { Link } = useNavigation();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")).trim(),
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    });
    setPending(false);
    if (error) setError(describeError(error, "Couldn't create your account. Try again."));
  }

  return (
    <AuthLayout
      title={inviteToken ? `Join ${workspaceName ?? "the workspace"}` : "Create your account"}
      description={
        inviteToken
          ? "You've been invited. Pick a name and password to create your account."
          : "Sign-up is invite-only: open the invite link you were sent, or use the email address it was sent to."
      }
      footer={
        <>
          Already have an account?{" "}
          <Link href={withInvite(routes.signIn, inviteToken)} className="text-foreground underline decoration-gray-8 underline-offset-4 hover:decoration-current">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="sign-up-name">Name</FieldLabel>
            <Input id="sign-up-name" name="name" autoComplete="name" required autoFocus />
          </Field>
          <Field>
            <FieldLabel htmlFor="sign-up-email">Email</FieldLabel>
            {invitedEmail ? (
              <>
                <div className="relative">
                  <Input
                    id="sign-up-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={invitedEmail}
                    readOnly
                    aria-describedby="sign-up-email-note"
                    className="cursor-default bg-muted pr-8 text-muted-foreground dark:bg-gray-3"
                  />
                  <LockIcon
                    className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                </div>
                <FieldDescription id="sign-up-email-note">
                  Invited as this address. For a different one, ask the owner for a new invite.
                </FieldDescription>
              </>
            ) : (
              <Input id="sign-up-email" name="email" type="email" autoComplete="email" required />
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="sign-up-password">Password</FieldLabel>
            <Input id="sign-up-password" name="password" type="password" autoComplete="new-password" minLength={8} required />
            <FieldDescription>At least 8 characters.</FieldDescription>
          </Field>
          <FormError message={error} />
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending ? "Creating account…" : inviteToken ? "Create account and join" : "Create account"}
          </Button>
          <SlowHint pending={pending} />
        </FieldGroup>
      </form>
    </AuthLayout>
  );
}
