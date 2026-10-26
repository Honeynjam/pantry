"use client";

import { BoardPage } from "@pantry/app/screens/board";
import { useParams } from "next/navigation";

export default function Page() {
  const params = useParams<{ key: string }>();
  return <BoardPage spaceKey={decodeURIComponent(params.key)} />;
}
