import { brand } from "@pantry/backend/brand";
import { SetupPage } from "@pantry/app/screens/setup";
import type { Metadata } from "next";

export const metadata: Metadata = { title: `Set up · ${brand.name}` };

export default function Page() {
  return <SetupPage />;
}
