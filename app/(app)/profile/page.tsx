import { redirect } from "next/navigation";

// "My profile" opens the edit page until the member profile view (US2.6) exists.
export default function MyProfilePage() {
  redirect("/profile/edit");
}
