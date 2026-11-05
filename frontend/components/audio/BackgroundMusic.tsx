"use client";

import { useEffect, useRef } from "react";
import { startBackgroundMusic } from "@/lib/backgroundMusic";

export default function BackgroundMusic({ active, src }: { active: boolean; src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio && active) return startBackgroundMusic(audio);
  }, [active, src]);

  return <audio ref={audioRef} src={src} loop preload="none" hidden aria-hidden="true" />;
}
