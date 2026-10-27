import { brand } from "@pantry/backend/brand";
import { SignInPage } from "@pantry/app/screens/sign-in";
import type { Metadata } from "next";

export const metadata: Metadata = { title: `Sign in · ${brand.name}` };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const { invite } = await searchParams;
  return <SignInPage inviteToken={typeof invite === "string" && invite ? invite : undefined} />;
}
