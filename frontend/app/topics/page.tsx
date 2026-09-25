"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import MainPage from "@/components/mainpage";
import { useLearningData } from "@/components/navigation/LearningShell";

const ARCHIVE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bree+Serif&family=Nunito:wght@400;600;700;800;900&display=swap');

  * {
    box-sizing: border-box;
  }

  /* =========================================================
     MAIN LIBRARY SCENE
  ========================================================= */

  .archive-scene {
    position: relative;
    min-height: 100vh;
    padding: 20px 20px 70px;
    overflow: hidden;

    font-family: "Nunito", sans-serif;
    color: #fbeed2;

    background:
      radial-gradient(
        circle at 50% 8%,
        rgba(255, 222, 150, .18),
        transparent 38%
      ),
      linear-gradient(
        180deg,
        rgba(15, 8, 10, .68),
        rgba(15, 8, 10, .58) 45%,
        rgba(10, 6, 8, .9)
      ),
      url("/login/library2.png") center / cover no-repeat fixed;
  }

  .archive-scene::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;

    background:
      radial-gradient(
        ellipse at center,
        transparent 35%,
        rgba(0, 0, 0, .4) 100%
      );

    z-index: 0;
  }

/* =========================================================
   TOP BAR
========================================================= */

.archive-topbar {
  position: relative;
  z-index: 100;

  display: flex;
  align-items: center;
  gap: 14px;

  max-width: 1180px;
  margin: 0 auto 10px;
}

.archive-back {
  position: relative;
  z-index: 101;

  display: grid;
  place-items: center;

  width: 44px;
  height: 44px;
  flex-shrink: 0;

  padding: 0;

  border-radius: 50%;
  border: 2px solid rgba(255, 226, 136, .42);

  background: rgba(20, 11, 9, .62);

  color: #ffe8a2;
  font-size: 20px;
  font-weight: 700;

  cursor: pointer;

  transition:
    transform .18s ease,
    border-color .18s ease,
    background .18s ease,
    box-shadow .18s ease;
}

.archive-back:hover {
  transform: translateX(-3px) scale(1.05);

  border-color: rgba(255, 226, 136, .95);

  background: rgba(65, 34, 15, .95);

  box-shadow:
    0 0 18px rgba(255, 211, 92, .35),
    0 5px 15px rgba(0, 0, 0, .35);
}

.archive-back:active {
  transform: translateX(-3px) scale(.96);
}

  .archive-back:focus-visible,
  .archive-info:focus-visible,
  .archive-floating-book:focus-visible,
  .archive-modal-close:focus-visible,
  .archive-btn:focus-visible {
    outline: 3px solid #ffe8a2;
    outline-offset: 3px;
  }

  .archive-title-block {
    flex: 1;
    min-width: 0;
  }

  .archive-title-block h1 {
    margin: 0;

    color: #fdf1cf;

    font-family: "Bree Serif", Georgia, serif;
    font-size: clamp(21px, 2.6vw, 28px);
    line-height: 1.1;

    text-shadow:
      0 2px 6px rgba(0, 0, 0, .65),
      0 0 20px rgba(255, 211, 92, .08);
  }

  .archive-title-block p {
    margin: 3px 0 0;

    color: #cdb786;

    font-size: 11px;
    font-weight: 700;
    letter-spacing: .4px;
  }

  .archive-stats {
    display: flex;
    align-items: center;
    justify-content: flex-end;

    gap: 8px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .archive-stats span {
    display: inline-flex;
    align-items: baseline;
    gap: 5px;

    padding: 7px 12px;

    border-radius: 999px;
    border: 1px solid rgba(255, 226, 136, .34);

    background: rgba(20, 11, 9, .58);
    backdrop-filter: blur(5px);

    color: #d9b673;

    font-size: 10px;
    font-weight: 800;

    white-space: nowrap;
  }

  .archive-stats b {
    color: #ffe8a2;

    font-family: "Bree Serif", Georgia, serif;
    font-size: 14px;
  }

  .archive-stats span.streak {
    background:
      linear-gradient(
        135deg,
        rgba(255, 211, 92, .2),
        rgba(255, 175, 0, .08)
      );

    border-color: rgba(255, 211, 92, .5);
  }

  .archive-info {
    display: grid;
    place-items: center;

    width: 35px;
    height: 35px;
    flex-shrink: 0;

    border-radius: 50%;
    border: 2px solid rgba(255, 226, 136, .4);

    background: rgba(20, 11, 9, .58);

    color: #ffe8a2;

    font-family: "Bree Serif", Georgia, serif;
    font-size: 15px;

    cursor: pointer;

    transition:
      background .18s ease,
      border-color .18s ease,
      transform .18s ease;
  }

  .archive-info:hover {
    background: rgba(20, 11, 9, .84);
    border-color: rgba(255, 226, 136, .82);
    transform: scale(1.05);
  }

  /* =========================================================
     ERROR / LOADING
  ========================================================= */

  .archive-error {
    position: relative;
    z-index: 20;

    display: flex;
    align-items: center;
    gap: 14px;

    max-width: 520px;
    margin: 24px auto 0;
    padding: 14px 16px;

    border: 2px solid rgba(199, 74, 66, .55);
    border-radius: 10px;

    background:
      linear-gradient(
        180deg,
        rgba(87, 29, 29, .55),
        rgba(36, 13, 13, .7)
      );

    color: #ffd9d4;
  }

  .archive-error img {
    height: 40px;
    width: auto;
    flex-shrink: 0;
  }

  .archive-error strong {
    display: block;

    font-family: "Bree Serif", Georgia, serif;
    font-size: 15px;

    color: #ffb6ae;
  }

  .archive-error p {
    margin: 2px 0 0;

    font-size: 12px;
    line-height: 1.5;
  }

  .archive-loading {
    position: relative;
    z-index: 20;

    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;

    padding: 120px 0;

    color: #e4cfa6;

    font-size: 13px;
    font-weight: 700;
  }

  .archive-loading i {
    width: 40px;
    height: 40px;

    border-radius: 50%;
    border: 4px solid rgba(255, 226, 136, .22);
    border-top-color: #ffd35c;

    animation: archive-spin 1s linear infinite;
  }

  .archive-empty {
    position: relative;
    z-index: 20;

    text-align: center;

    padding: 100px 20px;

    color: #d9b673;
    font-size: 14px;
  }

  @keyframes archive-spin {
    to {
      transform: rotate(360deg);
    }
  }

  

  .archive-rune {
    position: absolute;

    left: 50%;
    bottom: -10px;

    width: min(700px, 90%);
    aspect-ratio: 1 / 1;

    transform: translateX(-50%);

    border-radius: 50%;

    background:
      radial-gradient(
        circle,
        rgba(255, 211, 92, .12),
        transparent 68%
      );

    pointer-events: none;
  }


  /* =========================================================
   LARGE BOOK
========================================================= */

.archive-floating-book {
  position: relative;

  /* BIGGER BOOK */
  width: 220px;
  height: 300px;

  justify-self: center;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 0;

  border: none;
  border-radius: 7px 16px 16px 7px;

  background:
    linear-gradient(
      135deg,
      rgba(255,255,255,.16) 0%,
      rgba(255,255,255,.05) 25%,
      transparent 48%
    ),
    linear-gradient(
      180deg,
      rgba(255,255,255,.08),
      transparent 35%
    ),
    var(--book-gradient);

  box-shadow:
    -14px 0 0 -2px rgba(0,0,0,.65),
    0 22px 35px rgba(0,0,0,.55),
    0 0 28px var(--book-glow),
    inset 4px 0 12px rgba(0,0,0,.5),
    inset -3px 0 6px rgba(255,255,255,.04);

  cursor: pointer;

  animation:
    archive-float 5s ease-in-out infinite;

  animation-delay:
    calc(var(--i) * .35s);

  transition:
    transform .22s cubic-bezier(.34,1.56,.64,1),
    box-shadow .22s ease,
    filter .22s ease;
}

.archive-book-grid {
  width: min(1200px, calc(100% - 40px));
  margin: 0 auto;

  display: grid;
  grid-template-columns: repeat(4, 1fr);

  gap: 28px;

  padding: 200px 0 60px;
}


/* =========================================================
   BOOK SPINE
========================================================= */

.archive-floating-book::before {
  content: "";

  position: absolute;

  left: 0;
  top: 0;
  bottom: 0;

  width: 22px;

  border-radius: 7px 0 0 7px;

  background:
    linear-gradient(
      90deg,
      rgba(0,0,0,.62),
      rgba(0,0,0,.22) 60%,
      transparent
    );

  box-shadow:
    inset -2px 0 rgba(255,255,255,.08);

  z-index: 1;
}


/* =========================================================
   BOOK PAGE EDGE
========================================================= */

.archive-floating-book::after {
  content: "";

  position: absolute;

  right: -8px;
  top: 10px;
  bottom: 10px;

  width: 8px;

  border-radius: 0 4px 4px 0;

  background:
    repeating-linear-gradient(
      180deg,
      #d7bd83 0px,
      #d7bd83 2px,
      #9d8352 3px,
      #d7bd83 4px
    );

  opacity: .82;
}


/* =========================================================
   HOVER
========================================================= */

.archive-floating-book:hover {
  transform:
    translateY(-20px)
    scale(1.06)
    rotate(0deg);

  box-shadow:
    -14px 0 0 -2px rgba(0,0,0,.7),
    0 32px 55px rgba(0,0,0,.72),
    0 0 50px var(--book-glow),
    inset 4px 0 12px rgba(0,0,0,.5);

  filter: brightness(1.08);

  z-index: 30;
}


/* =========================================================
   ACTIVE
========================================================= */

.archive-floating-book:active {
  transform:
    translateY(-10px)
    scale(1.03);
}


/* =========================================================
   BOOK ROTATION
========================================================= */

.archive-floating-book:nth-child(5n+1) {
  transform: rotate(-3deg);
}

.archive-floating-book:nth-child(5n+2) {
  transform: rotate(-1.5deg);
}

.archive-floating-book:nth-child(5n+3) {
  transform: rotate(0deg);
}

.archive-floating-book:nth-child(5n+4) {
  transform: rotate(1.5deg);
}

.archive-floating-book:nth-child(5n+5) {
  transform: rotate(3deg);
}


/* =========================================================
   TABLET
========================================================= */

@media (max-width: 1000px) {
  .archive-floating-book {
    width: 190px;
    height: 265px;
  }

  .archive-floating-book::before {
    width: 19px;
  }
}


/* =========================================================
   MOBILE
========================================================= */

@media (max-width: 600px) {
  .archive-floating-book {
    width: 180px;
    height: 250px;
  }

  .archive-floating-book::before {
    width: 18px;
  }
}

  /* =========================================================
     BOOK ICON
  ========================================================= */

  .archive-floating-book-icon {
    position: absolute;

    top: 24px;
    left: 50%;

    transform: translateX(-50%);

    width: 64px;
    height: 64px;

    display: grid;
    place-items: center;

    color: #ffe8a2;

    z-index: 4;

    filter:
      drop-shadow(0 3px 5px rgba(0,0,0,.55))
      drop-shadow(0 0 12px rgba(255,211,92,.2));

    transition:
      transform .2s ease,
      filter .2s ease;
  }

  .archive-floating-book-icon svg {
    width: 100%;
    height: 100%;
  }

  .archive-floating-book:hover
  .archive-floating-book-icon {
    transform:
      translateX(-50%)
      translateY(-3px)
      scale(1.1);

    filter:
      drop-shadow(0 5px 7px rgba(0,0,0,.6))
      drop-shadow(0 0 18px rgba(255,211,92,.4));
  }

  /* =========================================================
     BOOK TITLE
  ========================================================= */

  .archive-floating-caption {
    position: absolute;

    left: 20px;
    right: 14px;
    top: 96px;

    display: flex;
    flex-direction: column;
    align-items: center;

    gap: 7px;

    pointer-events: none;

    z-index: 5;
  }

  .archive-floating-caption em {
    font-style: normal;

    color: rgba(255,232,162,.76);

    font-size: 9px;
    font-weight: 900;

    letter-spacing: 1.3px;

    text-transform: uppercase;

    text-shadow:
      0 2px 3px rgba(0,0,0,.8);
  }

  .archive-floating-caption b {
    color: #fff0c5;

    font-family: "Bree Serif", Georgia, serif;

    font-size: 17px;
    line-height: 1.15;

    text-align: center;

    max-width: 112px;

    text-shadow:
      0 2px 3px rgba(0,0,0,.8),
      0 0 8px rgba(0,0,0,.4);
  }

  /* =========================================================
     BOOK PROGRESS
  ========================================================= */

  .archive-book-progress {
    position: absolute;

    left: 25px;
    right: 18px;
    bottom: 28px;

    height: 5px;

    border-radius: 999px;

    overflow: hidden;

    background: rgba(0,0,0,.42);

    z-index: 5;
  }

  .archive-book-progress span {
    display: block;

    height: 100%;

    border-radius: inherit;

    background:
      linear-gradient(
        90deg,
        #d69b32,
        #ffe8a2
      );

    box-shadow:
      0 0 8px rgba(255,211,92,.5);

    transition:
      width .5s ease;
  }

  .archive-book-status {
    position: absolute;

    left: 0;
    right: 0;
    bottom: 10px;

    text-align: center;

    color: rgba(255,232,162,.8);

    font-size: 8px;
    font-weight: 900;

    letter-spacing: .8px;

    z-index: 5;
  }

  /* Completed */
  .archive-floating-book.is-completed {
    box-shadow:
      -12px 0 0 -2px rgba(0,0,0,.65),
      0 18px 30px rgba(0,0,0,.65),
      0 0 42px rgba(102,201,130,.34),
      inset 3px 0 10px rgba(0,0,0,.5);
  }

  .archive-floating-book.is-completed
  .archive-book-progress span {
    background:
      linear-gradient(
        90deg,
        #4f9f68,
        #8bd99b
      );

    box-shadow:
      0 0 8px rgba(102,201,130,.5);
  }

  .archive-floating-book.is-completed
  .archive-book-status {
    color: #8bd99b;
  }

  /* Active */
  .archive-floating-book.has-progress {
    box-shadow:
      -12px 0 0 -2px rgba(0,0,0,.65),
      0 18px 30px rgba(0,0,0,.65),
      0 0 34px var(--book-glow),
      inset 3px 0 10px rgba(0,0,0,.5);
  }

  /* =========================================================
     ANIMATION
  ========================================================= */

  @keyframes archive-float {
    0%, 100% {
      margin-top: 0;
    }

    50% {
      margin-top: -7px;
    }
  }

  /* =========================================================
     MODAL
  ========================================================= */

  .archive-modal-overlay {
    position: fixed;

    inset: 0;

    background:
      rgba(9, 5, 4, .74);

    backdrop-filter: blur(7px);

    display: flex;
    align-items: center;
    justify-content: center;

    z-index: 1000;

    animation:
      archive-fade-in .2s ease;

    padding: 20px;
  }

  .archive-modal {
    position: relative;

    width: 100%;
    max-width: 500px;

    max-height: calc(100vh - 40px);

    overflow-y: auto;

    padding: 38px;

    border: 2px solid rgba(255,226,136,.38);
    border-radius: 16px;

    background:
      linear-gradient(
        135deg,
        rgba(53,27,15,.98),
        rgba(24,11,8,.98)
      );

    box-shadow:
      0 30px 80px rgba(0,0,0,.9),
      0 0 50px rgba(255,211,92,.08),
      inset 0 1px rgba(255,226,136,.12);

    animation:
      archive-slide-up .35s cubic-bezier(.34,1.56,.64,1);
  }

  .archive-modal-close {
    position: absolute;

    top: 14px;
    right: 14px;

    width: 34px;
    height: 34px;

    border: none;
    border-radius: 50%;

    background:
      rgba(255,226,136,.1);

    color: #ffe8a2;

    font-size: 19px;

    cursor: pointer;

    display: grid;
    place-items: center;

    transition:
      background .2s ease,
      transform .2s ease;
  }

  .archive-modal-close:hover {
    background:
      rgba(255,226,136,.2);

    transform: rotate(90deg);
  }

  /* =========================================================
     MODAL BOOK
  ========================================================= */

  .archive-modal-book {
    display: flex;
    justify-content: center;

    margin-bottom: 28px;
  }

  .archive-modal-book-visual {
    position: relative;

    width: 190px;
    height: 245px;

    border-radius: 4px 12px 12px 4px;

    background:
      linear-gradient(
        135deg,
        rgba(255,255,255,.15) 0%,
        rgba(255,255,255,.05) 30%,
        transparent 50%
      ),
      linear-gradient(
        180deg,
        rgba(255,255,255,.08),
        transparent 35%
      ),
      var(--book-gradient);

    box-shadow:
      -14px 0 0 -3px rgba(0,0,0,.7),
      0 30px 60px rgba(0,0,0,.7),
      0 0 60px var(--book-glow),
      inset 3px 0 10px rgba(0,0,0,.6);

    display: grid;
    place-items: center;

    animation:
      archive-book-pop .5s cubic-bezier(.34,1.56,.64,1);
  }

  .archive-modal-book-visual::before {
    content: "";

    position: absolute;

    left: 0;
    top: 0;
    bottom: 0;

    width: 12px;

    border-radius: 4px 0 0 4px;

    background:
      linear-gradient(
        90deg,
        rgba(0,0,0,.5),
        transparent
      );
  }

  .archive-modal-book-visual::after {
    content: "";

    position: absolute;

    right: -8px;
    top: 10px;
    bottom: 10px;

    width: 8px;

    background:
      repeating-linear-gradient(
        180deg,
        #d7bd83 0px,
        #d7bd83 2px,
        #9d8352 3px,
        #d7bd83 4px
      );

    border-radius: 0 3px 3px 0;
  }

  .archive-modal-book-visual.is-completed {
    background:
      linear-gradient(
        135deg,
        rgba(255,255,255,.15),
        rgba(255,255,255,.05) 30%,
        transparent 50%
      ),
      linear-gradient(
        180deg,
        rgba(255,255,255,.08),
        transparent 35%
      ),
      linear-gradient(
        155deg,
        #2f4a34 0%,
        #1c3324 65%,
        #142219 100%
      );

    box-shadow:
      -14px 0 0 -3px rgba(0,0,0,.7),
      0 30px 60px rgba(0,0,0,.7),
      0 0 60px rgba(102,201,130,.3),
      inset 3px 0 10px rgba(0,0,0,.6);
  }

  /* Modal book icon */
  .archive-modal-book-icon {
    width: 95px;
    height: 95px;

    color: #ffe8a2;

    filter:
      drop-shadow(0 5px 7px rgba(0,0,0,.65))
      drop-shadow(0 0 20px rgba(255,211,92,.25));

    z-index: 2;
  }

  .archive-modal-book-icon svg {
    width: 100%;
    height: 100%;
  }

  /* =========================================================
     MODAL CONTENT
  ========================================================= */

  .archive-modal-content {
    text-align: center;
  }

  .archive-modal-label {
    display: inline-block;

    padding: 5px 14px;

    border-radius: 999px;

    background:
      rgba(255,226,136,.12);

    color: #ffd35c;

    font-size: 10px;
    font-weight: 800;

    letter-spacing: 1.2px;

    text-transform: uppercase;

    margin-bottom: 8px;
  }

  .archive-modal-title {
    margin: 0 0 8px;

    font-family: "Bree Serif", Georgia, serif;

    font-size: 29px;
    line-height: 1.2;

    color: #fdf1cf;

    text-shadow:
      0 2px 8px rgba(0,0,0,.6);
  }

  .archive-modal-status {
    margin: 0 0 16px;

    color: #d9b673;

    font-size: 13px;
    font-weight: 600;
  }

  .archive-modal-progress {
    height: 6px;

    background:
      rgba(255,226,136,.1);

    border-radius: 999px;

    overflow: hidden;

    margin-bottom: 20px;
  }

  .archive-progress-bar {
    height: 100%;

    background:
      linear-gradient(
        90deg,
        #ffd35c,
        #ffe8a2
      );

    transition:
      width .6s cubic-bezier(.34,1.56,.64,1);

    border-radius: inherit;

    box-shadow:
      0 0 12px rgba(255,211,92,.4);
  }

  .archive-modal-stats {
    display: grid;

    grid-template-columns:
      repeat(3, 1fr);

    gap: 12px;

    margin-bottom: 20px;
    padding: 16px;

    background:
      rgba(255,226,136,.06);

    border-radius: 10px;

    border: 1px solid rgba(255,226,136,.15);
  }

  .archive-modal-stats .stat {
    text-align: center;
  }

  .archive-modal-stats .stat-label {
    display: block;

    margin-bottom: 4px;

    color: #d9b673;

    font-size: 10px;
    font-weight: 800;

    text-transform: uppercase;
    letter-spacing: .5px;
  }

  .archive-modal-stats .stat-value {
    display: block;

    font-family: "Bree Serif", Georgia, serif;

    font-size: 20px;

    color: #ffe8a2;
  }

  .archive-modal-achievement {
    margin-bottom: 20px;
    padding: 12px 14px;

    border-radius: 8px;

    background:
      linear-gradient(
        135deg,
        rgba(102,201,130,.2),
        rgba(125,217,155,.1)
      );

    border: 1px solid rgba(102,201,130,.35);

    color: #7dd99b;

    font-size: 12px;
    font-weight: 700;

    text-align: center;

    animation:
      archive-pulse 1.5s ease-in-out infinite;
  }

  .archive-modal-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .archive-btn {
    padding: 13px 24px;

    border: none;
    border-radius: 10px;

    font-family: "Nunito", sans-serif;

    font-size: 14px;
    font-weight: 800;

    cursor: pointer;

    transition:
      transform .2s ease,
      box-shadow .2s ease,
      background .2s ease;

    text-transform: uppercase;
    letter-spacing: .5px;
  }

  .archive-btn-primary {
    background:
      linear-gradient(
        135deg,
        #ffd35c,
        #ffe8a2
      );

    color: #2c1e0a;

    box-shadow:
      0 6px 20px rgba(255,211,92,.35);
  }

  .archive-btn-primary:hover {
    transform: translateY(-2px);

    box-shadow:
      0 10px 30px rgba(255,211,92,.5);
  }

  .archive-btn-secondary {
    background:
      rgba(255,226,136,.08);

    color: #ffe8a2;

    border: 1.5px solid rgba(255,226,136,.3);
  }

  .archive-btn-secondary:hover {
    background:
      rgba(255,226,136,.15);

    border-color:
      rgba(255,226,136,.5);
  }

  /* =========================================================
     ANIMATIONS
  ========================================================= */

  @keyframes archive-fade-in {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }

  @keyframes archive-slide-up {
    from {
      opacity: 0;
      transform: translateY(40px) scale(.92);
    }

    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes archive-book-pop {
    0% {
      transform: scale(.75) rotateY(90deg);
      opacity: 0;
    }

    100% {
      transform: scale(1) rotateY(0);
      opacity: 1;
    }
  }

  @keyframes archive-pulse {
    0%, 100% {
      opacity: 1;
    }

    50% {
      opacity: .7;
    }
  }

  /* =========================================================
     RESPONSIVE
  ========================================================= */

  @media (max-width: 1000px) {
    .archive-shelf {
      grid-template-columns:
        repeat(3, minmax(150px, 1fr));

      gap: 55px 20px;
    }

    .archive-floating-book {
      width: 145px;
      height: 198px;
    }

    .archive-stats {
      max-width: 430px;
    }
  }

  @media (max-width: 760px) {
    .archive-topbar {
      flex-wrap: wrap;
    }

    .archive-stats {
      order: 3;
      width: 100%;
      justify-content: flex-start;
    }

    .archive-shelf {
      grid-template-columns:
        repeat(2, minmax(140px, 1fr));

      gap: 50px 16px;
    }

    .archive-floor {
      padding:
        45px 10px
        80px;
    }

    .archive-floor::before {
      width: 100%;
      height: 470px;
    }

    .archive-floor::after {
      width: 100%;
    }
  }

  @media (max-width: 520px) {
    .archive-scene {
      padding:
        14px 12px
        45px;
    }

    .archive-title-block p {
      display: none;
    }

    .archive-shelf {
      grid-template-columns:
        repeat(2, minmax(125px, 1fr));

      gap: 42px 10px;
    }

    .archive-floating-book {
      width: 125px;
      height: 175px;
    }

    .archive-floating-book-icon {
      top: 19px;
      width: 52px;
      height: 52px;
    }

    .archive-floating-caption {
      top: 78px;
      left: 17px;
      right: 12px;
    }

    .archive-floating-caption b {
      font-size: 14px;
      max-width: 92px;
    }

    .archive-book-progress {
      left: 21px;
      right: 16px;
      bottom: 25px;
    }

    .archive-book-status {
      bottom: 9px;
      font-size: 7px;
    }

    .archive-modal {
      padding: 28px 20px;
    }

    .archive-modal-book-visual {
      width: 160px;
      height: 210px;
    }

    .archive-modal-title {
      font-size: 25px;
    }
  }

  @media (max-width: 380px) {
    .archive-shelf {
      grid-template-columns: 1fr;
    }

    .archive-floating-book {
      width: 145px;
      height: 195px;
    }

    .archive-floating-book-icon {
      width: 60px;
      height: 60px;
    }

    .archive-floating-caption b {
      font-size: 16px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .archive-floating-book {
      animation: none;
    }

    .archive-floating-book:hover {
      transform: none;
    }

    .archive-modal {
      animation: none;
    }

    .archive-modal-book-visual {
      animation: none;
    }
  }
`;

/* =========================================================
   BOOK COLORS
========================================================= */

const BOOK_COLORS = [
  {
    gradient:
      "linear-gradient(155deg, #6b4a22 0%, #43300f 65%, #2c1e0a 100%)",
    glow: "rgba(255,211,92,.35)",
  },
  {
    gradient:
      "linear-gradient(155deg, #1a3a52 0%, #0f2438 65%, #0a1620 100%)",
    glow: "rgba(100,180,255,.3)",
  },
  {
    gradient:
      "linear-gradient(155deg, #3d2817 0%, #2a1810 65%, #1a0f0a 100%)",
    glow: "rgba(200,140,80,.3)",
  },
  {
    gradient:
      "linear-gradient(155deg, #2d4a2f 0%, #1c3324 65%, #142219 100%)",
    glow: "rgba(102,201,130,.3)",
  },
  {
    gradient:
      "linear-gradient(155deg, #5a2f2f 0%, #3a1f1f 65%, #251414 100%)",
    glow: "rgba(220,80,80,.3)",
  },
  {
    gradient:
      "linear-gradient(155deg, #4a3a2a 0%, #2f2415 65%, #1f1810 100%)",
    glow: "rgba(180,140,100,.3)",
  },
  {
    gradient:
      "linear-gradient(155deg, #3a2a4a 0%, #251a35 65%, #1a1225 100%)",
    glow: "rgba(150,100,200,.3)",
  },
  {
    gradient:
      "linear-gradient(155deg, #4a4a2a 0%, #2f2f15 65%, #1f1f10 100%)",
    glow: "rgba(180,180,80,.3)",
  },
];

/* =========================================================
   BOOK ICON
========================================================= */

function BookIcon({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role="presentation"
      aria-hidden="true"
    >
      <path
        d="M10 12c10-4 18-2 22 3v38c-4-5-12-7-22-3V12Z"
        fill="currentColor"
        opacity=".92"
      />

      <path
        d="M54 12c-10-4-18-2-22 3v38c4-5 12-7 22-3V12Z"
        fill="currentColor"
        opacity=".72"
      />

      <path
        d="M32 15v38"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />

      <path
        d="M16 22c5-1 10 0 14 3"
        fill="none"
        stroke="#3a210e"
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".65"
      />

      <path
        d="M48 22c-5-1-10 0-14 3"
        fill="none"
        stroke="#3a210e"
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".65"
      />

      <path
        d="M17 30c5-1 9 0 13 2"
        fill="none"
        stroke="#3a210e"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity=".45"
      />

      <path
        d="M47 30c-5-1-9 0-13 2"
        fill="none"
        stroke="#3a210e"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity=".45"
      />
    </svg>
  );
}

/* =========================================================
   TOPICS PAGE
========================================================= */

export default function TopicsPage() {
  const router = useRouter();

  const {
    data,
    error: loadError,
  } = useLearningData();

  const [selectedTopic, setSelectedTopic] =
    useState<string | null>(null);

  const topics = data?.topics ?? [];

  const activeTopics = Object.fromEntries(
    (data?.progress.active_sessions ?? []).map(
      (session) => [
        session.topic_entry_node,
        session.id,
      ],
    ),
  );

  const completedTopics = new Set(
    (data?.progress.completed_sessions ?? []).map(
      (session) => session.topic_entry_node,
    ),
  );

  const nodeStatuses = data?.statuses ?? {};
  const topicChains = data?.chains ?? {};


  const loading =
    !data && !loadError;

  const error =
    loadError?.message ?? null;

  /* =======================================================
     HELPERS
  ======================================================= */

  const getBookColor = (index: number) =>
    BOOK_COLORS[
      index % BOOK_COLORS.length
    ];

  const openTopic = (nodeId: string) => {
    router.push(`/topics/${nodeId}`);
  };

  const resumeTopic = (sessionId: string) => {
    router.push(
      `/session/${sessionId}/lesson`,
    );
  };

  const describeTopic = (
    topic: (typeof topics)[number],
  ) => {
    const isActive =
      topic.node_id in activeTopics;

    const isCompleted =
      completedTopics.has(
        topic.node_id,
      );

    const chain =
      topicChains[topic.node_id] || [];

    const trackTotal =
      chain.length;

    const trackMastered =
      chain.filter(
        (node) =>
          nodeStatuses[node.node_id] ===
          "mastered",
      ).length;

    const trackPct =
      trackTotal > 0
        ? Math.round(
            (trackMastered /
              trackTotal) *
              100,
          )
        : 0;

    const hasProgress =
      trackPct > 0 || isActive;

    const statusText =
      trackPct === 100
        ? "Mastered"
        : trackPct > 0 || isActive
          ? "In Progress"
          : "Not Attempted";

    const action = () =>
      isActive
        ? resumeTopic(
            activeTopics[
              topic.node_id
            ],
          )
        : openTopic(
            topic.node_id,
          );

    return {
      isActive,
      isCompleted,
      trackPct,
      hasProgress,
      statusText,
      action,
    };
  };

  const getMotivationalMessage = (
    trackPct: number,
  ): string => {
    if (trackPct === 100)
      return "Perfect mastery!";

    if (trackPct >= 75)
      return "Almost there!";

    if (trackPct >= 50)
      return "Halfway done!";

    if (trackPct > 0)
      return "Keep going!";

    return "Ready to start?";
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <MainPage immersive>
      <div className="archive-scene">

        <style
          dangerouslySetInnerHTML={{
            __html: ARCHIVE_CSS,
          }}
        />

        {/* =================================================
            TOP BAR
        ================================================= */}

        <div className="archive-topbar">

          <button
            type="button"
            className="archive-back"
            onClick={() => router.back()}
            aria-label="Go back to the previous page"
          >
            ←
          </button>

          <div className="archive-title-block">
            <h1>
              The Grand Library
            </h1>

            <p>
              Choose a volume and continue your journey.
            </p>
          </div>

          <div
            className="archive-stats"
            aria-label="Topics overview"
          >

            <span>
              <b>
                {loading
                  ? "--"
                  : String(
                      topics.length,
                    ).padStart(2, "0")}
              </b>

              Volumes
            </span>

            <span>
              <b>
                {loading
                  ? "--"
                  : String(
                      Object.keys(
                        activeTopics,
                      ).length,
                    ).padStart(2, "0")}
              </b>

              Active
            </span>

           
          </div>

          <button
            type="button"
            className="archive-info"
            aria-label="How the library works"
            title="Choose a book to begin learning."
          >
            i
          </button>

        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div
            className="archive-error"
            role="alert"
          >
            <img
              src="/suri-snake-sad.png"
              alt="Sad Suri"
            />

            <div>
              <strong>
                The archive lantern has dimmed.
              </strong>

              <p>
                {error}
              </p>
            </div>
          </div>
        )}

        {/* =================================================
            LOADING
        ================================================= */}

        {loading ? (
          <div className="archive-loading">
            <i />

            <p>
              Consulting the academy catalogue…
            </p>
          </div>
        ) : topics.length === 0 ? (
          <div className="archive-empty">
            No volumes have been mapped for you yet.
          </div>
        ) : (

          /* ===============================================
             LIBRARY
          =============================================== */

          <div className="archive-floor">

            <div className="archive-rune" />

              <div className="archive-book-grid">
              {topics.map(
                (topic) => {

                  const info =
                    describeTopic(
                      topic,
                    );

                  const index =
                    topics.findIndex(
                      (t) =>
                        t.node_id ===
                        topic.node_id,
                    );

                  const bookColor =
                    getBookColor(
                      index,
                    );

                  return (
                    <button
                      key={
                        topic.node_id
                      }
                      type="button"
                      className={[
                        "archive-floating-book",
                        info.hasProgress
                          ? "has-progress"
                          : "",
                        info.isCompleted
                          ? "is-completed"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}

                      style={{
                        ["--i" as any]:
                          index,

                        ["--pct" as any]:
                          info.trackPct,

                        ["--book-gradient" as any]:
                          info.isCompleted
                            ? "linear-gradient(155deg, #2f4a34 0%, #1c3324 65%, #142219 100%)"
                            : bookColor.gradient,

                        ["--book-glow" as any]:
                          info.isCompleted
                            ? "rgba(102,201,130,.3)"
                            : bookColor.glow,
                      }}

                      onClick={() =>
                        setSelectedTopic(
                          topic.node_id,
                        )
                      }

                      aria-label={`${info.isActive
                        ? "Resume"
                        : info.isCompleted
                          ? "Review"
                          : "Open"} ${
                        topic.label
                      }`}
                    >

                      {/* Book Icon */}
                      <span
                        className="archive-floating-book-icon"
                        aria-hidden="true"
                      >
                        <BookIcon />
                      </span>

                      {/* Topic Information */}
                      <span className="archive-floating-caption">

                        <em>
                          Chapter ·{" "}
                          {String(
                            index + 1,
                          ).padStart(
                            2,
                            "0",
                          )}
                        </em>

                        <b>
                          {topic.label}
                        </b>

                      </span>

                      {/* Progress */}
                      <span className="archive-book-progress">
                        <span
                          style={{
                            width: `${info.trackPct}%`,
                          }}
                        />
                      </span>

                      <span className="archive-book-status">

                        {info.isCompleted
                          ? "MASTERED"
                          : info.isActive
                            ? `${info.trackPct}% COMPLETE`
                            : "BEGIN"}

                      </span>

                    </button>
                  );
                },
              )}

          
          </div>
           </div>
        )}

        {/* =================================================
            TOPIC MODAL
        ================================================= */}

        {selectedTopic &&
          (() => {

            const topic =
              topics.find(
                (item) =>
                  item.node_id ===
                  selectedTopic,
              );

            if (!topic) {
              return null;
            }

            const info =
              describeTopic(
                topic,
              );

            const chain =
              topicChains[
                topic.node_id
              ] || [];

            const index =
              topics.findIndex(
                (item) =>
                  item.node_id ===
                  topic.node_id,
              );

            const bookColor =
              getBookColor(
                index,
              );

            return (
              <div
                className="archive-modal-overlay"
                onClick={() =>
                  setSelectedTopic(
                    null,
                  )
                }
              >

                <div
                  className="archive-modal"
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                >

                  {/* Close */}
                  <button
                    type="button"
                    className="archive-modal-close"
                    onClick={() =>
                      setSelectedTopic(
                        null,
                      )
                    }
                    aria-label="Close"
                  >
                    ✕
                  </button>

                  {/* Book Preview */}
                  <div className="archive-modal-book">

                    <div
                      className={[
                        "archive-modal-book-visual",
                        info.isCompleted
                          ? "is-completed"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}

                      style={{
                        ["--pct" as any]:
                          info.trackPct,

                        ["--book-gradient" as any]:
                          info.isCompleted
                            ? "linear-gradient(155deg, #2f4a34 0%, #1c3324 65%, #142219 100%)"
                            : bookColor.gradient,

                        ["--book-glow" as any]:
                          info.isCompleted
                            ? "rgba(102,201,130,.3)"
                            : bookColor.glow,
                      }}
                    >

                      <BookIcon
                        className="archive-modal-book-icon"
                      />

                    </div>

                  </div>

                  {/* Content */}
                  <div className="archive-modal-content">

                    <span className="archive-modal-label">
                      Chapter ·{" "}
                      {String(
                        index + 1,
                      ).padStart(
                        2,
                        "0",
                      )}
                    </span>

                    <h2 className="archive-modal-title">
                      {topic.label}
                    </h2>

                    <p className="archive-modal-status">
                      {info.statusText}
                      {" · "}
                      {info.trackPct}
                      % Mastered
                    </p>

                    {/* Progress */}
                    <div className="archive-modal-progress">
                      <div
                        className="archive-progress-bar"
                        style={{
                          width: `${info.trackPct}%`,
                        }}
                      />
                    </div>

                    {/* Stats */}
                    <div className="archive-modal-stats">

                      <div className="stat">
                        <span className="stat-label">
                          Lessons
                        </span>

                        <span className="stat-value">
                          {chain.length}
                        </span>
                      </div>

                      <div className="stat">
                        <span className="stat-label">
                          Mastered
                        </span>

                        <span className="stat-value">
                          {
                            chain.filter(
                              (node) =>
                                nodeStatuses[
                                  node.node_id
                                ] ===
                                "mastered",
                            ).length
                          }
                          /
                          {chain.length}
                        </span>
                      </div>

                      <div className="stat">
                        <span className="stat-label">
                          Est. Time
                        </span>

                        <span className="stat-value">
                          2h 30m
                        </span>
                      </div>

                    </div>

                    {/* Completed Message */}
                    {info.isCompleted && (
                      <div className="archive-modal-achievement">
                        Chapter Mastered! Great work!
                      </div>
                    )}

                    {/* Motivation */}
                    <p
                      style={{
                        fontSize:
                          "12px",
                        color:
                          "#d9b673",
                        marginBottom:
                          "16px",
                        textAlign:
                          "center",
                      }}
                    >
                      {
                        getMotivationalMessage(
                          info.trackPct,
                        )
                      }
                    </p>

                    {/* Actions */}
                    <div className="archive-modal-actions">

                      <button
                        type="button"
                        className="archive-btn archive-btn-primary"

                        onClick={() => {
                          info.action();
                          setSelectedTopic(
                            null,
                          );
                        }}
                      >
                        {info.isActive
                          ? "Resume Learning"
                          : info.isCompleted
                            ? "Review"
                            : "Start Learning"}
                      </button>

                      <button
                        type="button"
                        className="archive-btn archive-btn-secondary"

                        onClick={() =>
                          setSelectedTopic(
                            null,
                          )
                        }
                      >
                        Maybe Later
                      </button>

                    </div>

                  </div>

                </div>

              </div>
            );
          })()}

      </div>
    </MainPage>
  );
}