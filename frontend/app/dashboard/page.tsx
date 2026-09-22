"use client";
import MainPage from "@/components/mainpage";
import { useWorldNavigation } from "@/components/navigation/LearningShell";
export default function DashboardPage() {
  const {error}=useWorldNavigation();
  return <MainPage immersive>{error&&<div className="world-error" role="alert">{error}</div>}</MainPage>;
}
