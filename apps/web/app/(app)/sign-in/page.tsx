import { brand } from "@pantry/backend/brand";
import { SignInPage } from "@pantry/app";
import type { Metadata } from "next";

export const metadata: Metadata = { title: `Sign in · ${brand.name}` };

export default function Page() {
  return <SignInPage />;
}
