"use client";

import { SettingsPage } from "@pantry/app/screens/settings/settings-page";
import { useParams } from "next/navigation";

export default function Page() {
  const params = useParams<{ section: string }>();
  return <SettingsPage section={params.section} />;
}
