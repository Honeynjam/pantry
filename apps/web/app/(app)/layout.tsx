import type { ReactNode } from "react";
import { ClientRoot } from "./client-root";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <ClientRoot>{children}</ClientRoot>;
}
