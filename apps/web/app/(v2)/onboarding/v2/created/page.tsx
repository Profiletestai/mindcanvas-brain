import { redirect } from "next/navigation";
import { WELCOME_PATH } from "../_lib/progress";

/**
 * The Organisation Created screen has been removed from onboarding.
 *
 * Keep this route as a redirect so old browser bookmarks and in-progress
 * sessions do not receive a 404.
 */
export default function OrganisationCreatedPage() {
  redirect(WELCOME_PATH);
}
