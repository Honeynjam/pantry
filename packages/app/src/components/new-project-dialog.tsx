"use client";

import { api } from "@pantry/backend/api";
import { Button } from "@pantry/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@pantry/ui/components/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@pantry/ui/components/field";
import { Input } from "@pantry/ui/components/input";
import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { routes, useNavigation } from "../navigation";
import { describeError, FormError } from "../screens/form-error";

/** "Web app" → "WEB"; "2nd brain" → "ND" (keys start with a letter). */
export function suggestKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^[0-9]+/, "")
    .slice(0, 3);
}

/** Name + key; the key is suggested from the name until you type your own. Opens the new project. */
export function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createProject = useMutation(api.projects.create);
  const { navigate } = useNavigation();
  const [name, setName] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const shownKey = key ?? suggestKey(name);

  function reset() {
    setName("");
    setKey(null);
    setError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const created = await createProject({ name, key: shownKey });
      onOpenChange(false);
      reset();
      navigate(routes.project(created.key));
    } catch (err) {
      setError(describeError(err, "Couldn't create the project."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>Issues in it get keys like {shownKey || "KEY"}-1. The key can&apos;t change later.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel htmlFor="new-project-name">Name</FieldLabel>
              <Input
                id="new-project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Website"
                required
                autoFocus
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-project-key">Key</FieldLabel>
              <Input
                id="new-project-key"
                value={shownKey}
                onChange={(event) => setKey(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
                className="font-mono uppercase"
                required
                minLength={2}
                maxLength={10}
                pattern="[A-Z][A-Z0-9]{1,9}"
                autoComplete="off"
              />
              <FieldDescription>2–10 letters or digits, starting with a letter.</FieldDescription>
            </Field>
          </FieldGroup>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim() || shownKey.length < 2}>
              {pending ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
