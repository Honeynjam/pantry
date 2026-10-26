"use client";

import { SpacePage } from "@pantry/app";
import { useParams } from "next/navigation";

export default function Page() {
  const params = useParams<{ key: string }>();
  return <SpacePage spaceKey={decodeURIComponent(params.key)} />;
}
