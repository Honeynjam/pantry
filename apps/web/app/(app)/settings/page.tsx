import { routes } from "@pantry/app";
import { redirect } from "next/navigation";

export default function Page() {
  redirect(routes.settings());
}
