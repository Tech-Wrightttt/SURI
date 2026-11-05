"use client";

import { useCallback, useEffect, useRef } from "react";
import { getEffectiveAudioVolume, subscribeAudioSettings } from "@/lib/audioPreferences";

export function createSoundEffect(audio: HTMLAudioElement) {
  let disposed = false;
  const syncVolume = () => {
    audio.volume = getEffectiveAudioVolume("effects");
    if (audio.volume === 0) audio.pause();
  };
  audio.loop = false;
  const unsubscribe = subscribeAudioSettings(syncVolume);
  syncVolume();

  return {
    play() {
      if (disposed) return;
      syncVolume();
      if (audio.volume === 0) return;
      try {
        // Reuse one voice so quick carousel changes don't stack overlapping sounds.
        audio.currentTime = 0;
        void audio.play().catch(() => {});
      } catch { /* An unavailable sound must not interrupt navigation. */ }
    },
    dispose() {
      disposed = true;
      unsubscribe();
      audio.pause();
    },
  };
}

export function useSoundEffect() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playerRef = useRef<ReturnType<typeof createSoundEffect> | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const player = createSoundEffect(audio);
    playerRef.current = player;
    return () => { player.dispose(); playerRef.current = null; };
  }, []);

  const play = useCallback(() => playerRef.current?.play(), []);
  return { audioRef, play };
}
