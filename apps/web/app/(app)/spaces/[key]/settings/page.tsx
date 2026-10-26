"use client";

import { SpaceSettingsPage } from "@pantry/app";
import { useParams } from "next/navigation";

export default function Page() {
  const params = useParams<{ key: string }>();
  return <SpaceSettingsPage spaceKey={decodeURIComponent(params.key)} />;
}
