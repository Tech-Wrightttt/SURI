"use client";

type BackToTopButtonProps = {
  className: string;
};

/** Reuses the calling route's back-button treatment for a local page action. */
export default function BackToTopButton({ className }: BackToTopButtonProps) {
  const scrollToTop = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return <button type="button" className={className} onClick={scrollToTop} aria-label="Scroll back to the top of the page">
    <span aria-hidden="true">↑</span> Back to top
  </button>;
}
