"use client";

import { ProjectSettingsPage } from "@pantry/app";
import { useParams } from "next/navigation";

export default function Page() {
  const params = useParams<{ key: string }>();
  return <ProjectSettingsPage projectKey={decodeURIComponent(params.key)} />;
}
