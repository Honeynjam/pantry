import { routes } from "@pantry/app/routes";
import { redirect } from "next/navigation";

export default function Page() {
  redirect(routes.settings());
}
