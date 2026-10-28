"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { LogOut } from "lucide-react";

export default function LogoutConfirmModal({ opener, onClose, onConfirm }: {
  opener: HTMLElement | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const buttons = Array.from(dialogRef.current.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      opener?.focus();
    };
  }, [onClose, opener]);

  return createPortal(
    <div className="suri-logout-overlay" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div ref={dialogRef} className="suri-logout-modal" role="dialog" aria-modal="true" aria-labelledby="suri-logout-title" aria-describedby="suri-logout-description">
        <div className="suri-logout-header" aria-hidden="true" />
        <div className="suri-logout-content">
          <span className="suri-logout-icon" aria-hidden="true"><LogOut size={28} strokeWidth={2.5} /></span>
          <h2 id="suri-logout-title">Are You Logging Out?</h2>
          <p id="suri-logout-description">You can always log back in at any time.</p>
        </div>
        <footer className="suri-logout-actions">
          <button ref={cancelRef} type="button" className="suri-logout-button" onClick={onClose}>Cancel</button>
          <button type="button" className="suri-logout-button suri-logout-confirm" onClick={onConfirm}>Log out</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
