"use client";

import MainPage from "@/components/mainpage";
import { useWorldNavigation } from "@/components/navigation/LearningShell";

export default function PlaygroundPage() {
  const { navigate } = useWorldNavigation();
  return <MainPage immersive>
    <div className="flex justify-center px-4 py-8">
      <button type="button" className="topics-library-back" onClick={() => navigate("/dashboard")} aria-label="Return to dashboard"><span aria-hidden="true">←</span> Go back</button>
    </div>
  </MainPage>;
}
