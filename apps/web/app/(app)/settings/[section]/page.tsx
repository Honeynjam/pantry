"use client";

import { SettingsPage } from "@pantry/app";
import { useParams } from "next/navigation";

export default function Page() {
  const params = useParams<{ section: string }>();
  return <SettingsPage section={params.section} />;
}
