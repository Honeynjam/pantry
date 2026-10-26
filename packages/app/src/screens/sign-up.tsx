"use client";

import { Button } from "@pantry/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@pantry/ui/components/field";
import { Input } from "@pantry/ui/components/input";
import { useState, type FormEvent } from "react";
import { EntryGate } from "../entry";
import { routes, useNavigation } from "../navigation";
import { useAuthClient } from "../providers";
import { AuthLayout } from "./auth-layout";
import { describeError, FormError } from "./form-error";
import { SlowHint } from "./slow-hint";

/** Invite-only sign-up. The server rejects emails without a pending invite (accepting invites: M2). */
export function SignUpPage() {
  return <EntryGate allow={["signed-out"]}>{() => <SignUpForm />}</EntryGate>;
}

function SignUpForm() {
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
      title="Create your account"
      description="Sign-up is invite-only: use the email address your invite was sent to."
      footer={
        <>
          Already have an account?{" "}
          <Link href={routes.signIn} className="text-foreground underline decoration-gray-8 underline-offset-4 hover:decoration-current">
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
            <Input id="sign-up-email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="sign-up-password">Password</FieldLabel>
            <Input id="sign-up-password" name="password" type="password" autoComplete="new-password" minLength={8} required />
            <FieldDescription>At least 8 characters.</FieldDescription>
          </Field>
          <FormError message={error} />
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending ? "Creating account…" : "Create account"}
          </Button>
          <SlowHint pending={pending} />
        </FieldGroup>
      </form>
    </AuthLayout>
  );
}
