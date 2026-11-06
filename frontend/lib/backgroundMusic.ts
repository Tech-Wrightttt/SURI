"use client";

import { getEffectiveAudioVolume, subscribeAudioSettings } from "@/lib/audioPreferences";

export function isBackgroundMusicRoute(pathname: string) {
  return ["/dashboard", "/topics", "/progress", "/history-logs", "/leaderboard", "/playground", "/calculator"].includes(pathname)
    || pathname.startsWith("/topics/");
}

export function isLessonMusicRoute(pathname: string) {
  return /^\/session\/[^/]+\/lesson\/?$/.test(pathname);
}

export function isQuizMusicRoute(pathname: string) {
  return /^\/session\/[^/]+\/quiz\/?$/.test(pathname);
}

export function isPracticeMusicRoute(pathname: string) {
  return /^\/session\/[^/]+\/practice\/?$/.test(pathname);
}

export function isDiagnosticMusicRoute(pathname: string) {
  return /^\/session\/[^/]+\/diagnostic\/?$/.test(pathname);
}

export function isResultsMusicRoute(pathname: string) {
  return /^\/session\/[^/]+\/(?:results|gap-result)\/?$/.test(pathname);
}

export function startBackgroundMusic(audio: HTMLAudioElement, page: Document = document) {
  const syncPlayback = () => {
    audio.volume = getEffectiveAudioVolume("music");
    if (page.visibilityState !== "visible" || audio.volume === 0) {
      audio.pause();
    } else if (audio.paused) {
      // Autoplay may be blocked until a click or keypress. Retry on that gesture.
      void audio.play().catch(() => {});
    }
  };

  audio.loop = true;
  const unsubscribe = subscribeAudioSettings(syncPlayback);
  page.addEventListener("pointerdown", syncPlayback, { capture: true });
  page.addEventListener("keydown", syncPlayback, { capture: true });
  page.addEventListener("visibilitychange", syncPlayback);
  syncPlayback();

  return () => {
    unsubscribe();
    page.removeEventListener("pointerdown", syncPlayback, { capture: true });
    page.removeEventListener("keydown", syncPlayback, { capture: true });
    page.removeEventListener("visibilitychange", syncPlayback);
    audio.pause();
  };
}
