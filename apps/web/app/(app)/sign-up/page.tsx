import { brand } from "@pantry/backend/brand";
import { SignUpPage } from "@pantry/app";
import type { Metadata } from "next";

export const metadata: Metadata = { title: `Create your account · ${brand.name}` };

export default async function Page({ searchParams }: { searchParams: Promise<{ invite?: string | string[] }> }) {
  const { invite } = await searchParams;
  return <SignUpPage inviteToken={typeof invite === "string" && invite ? invite : undefined} />;
}
