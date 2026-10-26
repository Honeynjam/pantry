"use client";

import { Button } from "@pantry/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@pantry/ui/components/field";
import { Input } from "@pantry/ui/components/input";
import { useState, type FormEvent } from "react";
import { EntryGate } from "../entry";
import { routes, useNavigation } from "../navigation";
import { useAuthClient } from "../providers";
import { AuthLayout } from "./auth-layout";
import { describeError, FormError } from "./form-error";

export function SignInPage() {
  return <EntryGate allow={["signed-out"]}>{() => <SignInForm />}</EntryGate>;
}

function SignInForm() {
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
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setPending(false);
    // On success the entry gate sees the session and moves on to the workspace.
    if (error) setError(describeError(error, "Couldn't sign in. Check your email and password."));
  }

  return (
    <AuthLayout
      title="Sign in"
      description="Welcome back."
      footer={
        <>
          Have an invite?{" "}
          <Link href={routes.signUp} className="text-foreground underline decoration-gray-8 underline-offset-4 hover:decoration-current">
            Create your account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate={false}>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="sign-in-email">Email</FieldLabel>
            <Input id="sign-in-email" name="email" type="email" autoComplete="email" required autoFocus />
          </Field>
          <Field>
            <FieldLabel htmlFor="sign-in-password">Password</FieldLabel>
            <Input id="sign-in-password" name="password" type="password" autoComplete="current-password" required />
          </Field>
          <FormError message={error} />
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </FieldGroup>
      </form>
    </AuthLayout>
  );
}
