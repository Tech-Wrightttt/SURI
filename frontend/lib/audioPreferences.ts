"use client";

import { useCallback, useSyncExternalStore } from "react";

export type AudioChannel = "master" | "music" | "effects";
const DEFAULT_VOLUMES = { master: 100, music: 35, effects: 100 } as const;
const VOLUME_KEYS = { master: "suri_master_volume", music: "suri_music_volume", effects: "suri_effects_volume" };
const VOLUME_EVENT = "suri:audio-volume-change";
const memoryVolumes: Record<AudioChannel, number> = { ...DEFAULT_VOLUMES };
const storageUnavailable = new Set<AudioChannel>();

export function getAudioVolume(channel: AudioChannel) {
  if (typeof window === "undefined") return DEFAULT_VOLUMES[channel];
  if (storageUnavailable.has(channel)) return memoryVolumes[channel];
  try {
    const saved = window.localStorage.getItem(VOLUME_KEYS[channel]);
    if (saved === null || saved.trim() === "") return memoryVolumes[channel];
    const volume = Number(saved);
    return Number.isFinite(volume) ? Math.max(0, Math.min(100, Math.round(volume))) : memoryVolumes[channel];
  } catch { return memoryVolumes[channel]; }
}

export function getEffectiveAudioVolume(channel: "music" | "effects") {
  return getAudioVolume("master") * getAudioVolume(channel) / 10_000;
}

export function subscribeAudioSettings(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || Object.values(VOLUME_KEYS).includes(event.key)) listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(VOLUME_EVENT, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(VOLUME_EVENT, listener);
  };
}

export function setAudioVolume(channel: AudioChannel, volume: number) {
  if (typeof window === "undefined" || !Number.isFinite(volume)) return;
  memoryVolumes[channel] = Math.max(0, Math.min(100, Math.round(volume)));
  try {
    window.localStorage.setItem(VOLUME_KEYS[channel], String(memoryVolumes[channel]));
    storageUnavailable.delete(channel);
  } catch { storageUnavailable.add(channel); }
  window.dispatchEvent(new Event(VOLUME_EVENT));
}

export function useAudioVolume(channel: AudioChannel) {
  const getSnapshot = useCallback(() => getAudioVolume(channel), [channel]);
  const getServerSnapshot = useCallback(() => DEFAULT_VOLUMES[channel], [channel]);
  return useSyncExternalStore(subscribeAudioSettings, getSnapshot, getServerSnapshot);
}
