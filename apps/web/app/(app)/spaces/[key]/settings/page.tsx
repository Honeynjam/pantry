"use client";

import { SpaceSettingsPage } from "@pantry/app/screens/space-settings";
import { useParams } from "next/navigation";

export default function Page() {
  const params = useParams<{ key: string }>();
  return <SpaceSettingsPage spaceKey={decodeURIComponent(params.key)} />;
}
