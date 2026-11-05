"use client";

import MainPage from "@/components/mainpage";
import { useWorldNavigation } from "@/components/navigation/LearningShell";
import LeaderboardList from "@/components/leaderboard/LeaderboardList";
import styles from "./leaderboard-page.module.css";

export default function LeaderboardPage() {
  const { navigate } = useWorldNavigation();

  return <MainPage immersive>
    <div className={`progress-library-page history-route-page leaderboard-route-page ${styles.page}`}>
      <div className="progress-library-back-row">
        <button type="button" className="topics-library-back" onClick={() => navigate("/dashboard")} aria-label="Return to dashboard"><span aria-hidden="true">←</span> Go back</button>
      </div>
      <header className={`progress-library-header ${styles.header}`}>
        <div className="progress-library-kicker"><span aria-hidden="true" /> SURI&apos;S HALL OF QUIZZES <span aria-hidden="true" /></div>
        <h1>Quiz <em>Leaderboard</em></h1>
      </header>
      <LeaderboardList />
    </div>
  </MainPage>;
}
