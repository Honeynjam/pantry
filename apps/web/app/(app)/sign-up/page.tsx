import { brand } from "@pantry/backend/brand";
import { SignUpPage } from "@pantry/app";
import type { Metadata } from "next";

export const metadata: Metadata = { title: `Create your account · ${brand.name}` };

export default function Page() {
  return <SignUpPage />;
}
