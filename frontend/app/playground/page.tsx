"use client";

import MainPage from "@/components/mainpage";
import { useWorldNavigation } from "@/components/navigation/LearningShell";
import styles from "./playground.module.css";

export default function PlaygroundPage() {
  const { navigate } = useWorldNavigation();
  return <MainPage immersive>
    <div className={`progress-library-page playground-route-page ${styles.page}`}>
      <div className="progress-library-back-row">
        <button type="button" className="topics-library-back" onClick={() => navigate("/dashboard")} aria-label="Return to dashboard"><span aria-hidden="true">←</span> Go back</button>
      </div>
      <header className="progress-library-header">
        <div className="progress-library-kicker"><span aria-hidden="true" /> SURI&apos;S PLAYGROUND <span aria-hidden="true" /></div>
        <h1>Your <em>Playground</em></h1>
      </header>
    </div>
  </MainPage>;
}
