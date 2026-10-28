import { redirect } from "next/navigation";

/** Preserve bookmarks to the former Error History page. */
export default function ErrorHistoryPage() {
  redirect("/playground");
}
