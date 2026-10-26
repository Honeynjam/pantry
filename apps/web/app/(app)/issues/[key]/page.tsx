"use client";

import { IssuePage } from "@pantry/app/screens/issue";
import { useParams } from "next/navigation";

export default function Page() {
  const params = useParams<{ key: string }>();
  return <IssuePage issueKey={decodeURIComponent(params.key)} />;
}
