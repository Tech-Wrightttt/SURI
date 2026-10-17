"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Coins } from "lucide-react";

export type PointsNoticeData = {
  action: string;
  required: number;
  current: number;
  failed?: boolean;
  opener: HTMLElement | null;
};

export default function PointsNotice({ notice, onClose }: {
  notice: PointsNoticeData;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      notice.opener?.focus();
    };
  }, [notice.opener]);

  const shortfall = Math.max(0, notice.required - notice.current);
  const format = (points: number) => points.toLocaleString("en-US");

  return createPortal(
    <dialog
      ref={dialogRef}
      className="suri-points-notice"
      aria-modal="true"
      aria-labelledby="suri-points-title"
      aria-describedby="suri-points-description"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        if (event.key === "Tab") {
          event.preventDefault();
          event.currentTarget.querySelector("button")?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
    >
      <div className="suri-points-content">
        <span className="suri-points-emblem" aria-hidden="true"><Coins size={30} strokeWidth={2} /></span>
        <p className="suri-points-eyebrow">{notice.action}</p>
        <h2 id="suri-points-title">{notice.failed ? "Couldn’t use this boost" : "Not enough points yet"}</h2>
        <p id="suri-points-description">
          {notice.failed
            ? "We couldn’t complete your request. Please try again."
            : <>You need <strong>{format(shortfall)} more points</strong> for this boost.</>}
        </p>
        {!notice.failed && (
          <>
            <dl className="suri-points-balance">
              <div><dt>Your points</dt><dd>{format(notice.current)} <span>pts</span></dd></div>
              <div><dt>Boost cost</dt><dd>{format(notice.required)} <span>pts</span></dd></div>
            </dl>
            <p className="suri-points-guidance">Keep solving runes to earn points. You’ve got this!</p>
          </>
        )}
        <p className="suri-points-paused">{notice.action === "Save Streak" ? "Your next rune will wait until you’re ready." : "Your timer is paused while this message is open."}</p>
        <button type="button" autoFocus className="suri-points-continue" onClick={onClose}>Keep forging</button>
      </div>
    </dialog>,
    document.body,
  );
}
