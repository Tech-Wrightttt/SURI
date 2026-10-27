import { redirect } from "next/navigation";

/** The former Error History destination is now the empty Playground. */
export default function ErrorHistoryPage() {
  redirect("/playground");
}
