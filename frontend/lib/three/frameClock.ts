type FrameClock = { elapsedTime?: number; getElapsed?: () => number };

// Fiber's render loop updates the stock Clock and the patched Timer before useFrame.
export function getFrameElapsedTime(clock: FrameClock): number {
  return clock.getElapsed?.() ?? clock.elapsedTime ?? 0;
}
