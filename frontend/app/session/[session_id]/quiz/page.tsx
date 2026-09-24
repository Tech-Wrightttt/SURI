"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  getSession,
  startQuiz,
  submitQuizStep,
  skipQuizStep,
  useQuizHint,
  finishQuiz,
  QuizProblem,
  QuizFinishResponse,
} from "../../../../lib/api";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import {
  Timer,
  Lightbulb,
  SkipForward,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Flame,
  ShieldAlert,
  Sparkles,
  BookOpen,
  Snowflake,
} from "lucide-react";

type QuizState =
  | "LOADING"
  | "INTRO"
  | "STEP"
  | "STEP_RESULT"
  | "SUMMARY";

const QUIZ_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bree+Serif&family=Nunito:wght@400;600;700;800;900&display=swap');

  .quiz-forge {
    min-height: 100vh;
    padding: clamp(10px, 1.5vw, 18px);
    background:
      radial-gradient(circle at 50% 0%, rgba(250,204,96,0.18), transparent 28%),
      linear-gradient(135deg, #1b0e12 0%, #392016 42%, #151025 100%);
    color: #fff4d5;
    font-family: Georgia, 'Times New Roman', serif;
    position: relative;
    overflow-x: hidden;
  }

  .quiz-forge::before {
    content: "";
    position: fixed;
    inset: 8px;
    z-index: 0;
    pointer-events: none;
    background: rgba(0,0,0,0.36);
  }

  .quiz-forge::after {
    content: "";
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background:
      radial-gradient(circle at 16% 22%, rgba(255,211,92,0.12), transparent 24%),
      radial-gradient(circle at 84% 18%, rgba(155,67,207,0.16), transparent 26%),
      url('/login/arena.png') center bottom / cover no-repeat;
    opacity: .38;
    mix-blend-mode: screen;
  }

  .quiz-shell {
    position: relative;
    z-index: 1;
    width: min(1180px, 100%);
    margin: 0 auto;
  }

  /* =========================
     HUD
  ========================= */

  .quiz-hud {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 18px;
    align-items: center;
    min-height: 112px;
    margin-bottom: 18px;
    padding: 18px clamp(16px, 3vw, 34px);

    border-radius: 0 0 26px 26px;

    background:
      linear-gradient(
        90deg,
        #70411f 0 16px,
        transparent 16px calc(100% - 16px),
        #70411f calc(100% - 16px)
      ),
      linear-gradient(
        180deg,
        #8b5527 0 14px,
        transparent 14px calc(100% - 14px),
        #8b5527 calc(100% - 14px)
      ),
      linear-gradient(
        180deg,
        rgba(252,229,177,0.97),
        rgba(235,189,105,0.97)
      );

    box-shadow:
      0 12px 0 rgba(39,18,10,0.84),
      0 24px 42px rgba(0,0,0,0.38),
      inset 0 0 0 4px #3b1d13,
      inset 0 0 0 10px rgba(255,198,92,0.18);
  }

  .quiz-hud::before {
    content: "";
    position: absolute;
    inset: 13px;
    border: 2px solid rgba(111,61,28,0.18);
    border-radius: 0 0 18px 18px;
    pointer-events: none;
  }

  .quiz-title-block {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }

  .quiz-suri {
    height: 68px;
    width: auto;
    object-fit: contain;
    filter:
      drop-shadow(3px 0 0 #17100a)
      drop-shadow(-3px 0 0 #17100a)
      drop-shadow(0 10px 18px rgba(76,194,117,0.44));
  }

  .quiz-eyebrow {
    display: block;
    color: #6c278e;
    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1.8px;
    text-transform: uppercase;
  }

  .quiz-title {
    color: #3a2111;
    font-family: "Bree Serif", Georgia, serif;
    font-size: clamp(26px, 3.5vw, 40px);
    font-weight: 900;
    line-height: 1;
    text-shadow: 0 2px 0 rgba(255,255,255,0.45);
  }

  .quiz-subtitle {
    margin-top: 6px;
    color: #4e3477;
    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .8px;
  }

  .quiz-hud-right {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 9px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .quiz-stat {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 42px;
    padding: 6px 11px;

    border: 3px solid #6d411c;
    border-radius: 8px;

    background:
      linear-gradient(
        180deg,
        #fff6aa,
        #ffd35c 58%,
        #c7832e
      );

    color: #321008;

    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 900;

    box-shadow: 0 5px 0 rgba(72,34,16,0.72);
  }

  .quiz-stat.timer {
    background:
      linear-gradient(
        180deg,
        #ffe4e1,
        #ffaaa1 58%,
        #c74a42
      );
  }

  .quiz-stat.streak {
    background:
      linear-gradient(
        180deg,
        #fff6aa,
        #ffd35c 58%,
        #c7832e
      );
  }

  .quiz-exit {
    position: relative;
    z-index: 1;

    min-height: 42px;
    padding: 0 16px;

    border: 3px solid #6d411c;
    border-radius: 8px;

    background:
      linear-gradient(
        180deg,
        #fff6aa,
        #ffd35c 58%,
        #c7832e
      );

    color: #321008;

    font-family: "Bree Serif", Georgia, serif;
    font-size: 15px;
    font-weight: 900;

    box-shadow: 0 5px 0 rgba(72,34,16,0.72);
    transition: transform .12s ease, filter .12s ease;
    cursor: pointer;
  }

  .quiz-exit:hover {
    transform: translateY(-2px);
    filter: brightness(1.04);
  }

  /* =========================
     TIMER
  ========================= */

  .quiz-timer-track {
    position: relative;
    z-index: 2;
    height: 10px;
    margin: -18px 14px 18px;
    overflow: hidden;

    border: 2px solid #5e3619;
    background: #24130d;

    box-shadow:
      0 4px 0 #160b07,
      inset 0 0 0 1px rgba(255,255,255,.08);
  }

  .quiz-timer-fill {
    height: 100%;
    background:
      linear-gradient(
        90deg,
        #7f2cad,
        #ffd35c,
        #9df2a7
      );

    transition: width .1s linear;
  }

  /* =========================
     FORGE CARDS
  ========================= */

  .quiz-card {
    position: relative;
    z-index: 1;

    border: 5px solid #5e3619;

    background:
      linear-gradient(
        90deg,
        rgba(25,12,8,0.94),
        rgba(83,46,24,0.96),
        rgba(25,12,8,0.94)
      ),
      repeating-linear-gradient(
        90deg,
        rgba(255,255,255,0.035) 0 2px,
        transparent 2px 66px
      );

    box-shadow:
      0 9px 0 #160b07,
      inset 0 0 0 3px rgba(245,199,93,0.28);

    padding: 14px;
  }

  .quiz-panel {
    border: 3px solid #8e5b20;
    background: linear-gradient(180deg, #57321d, #24130d);
    box-shadow:
      inset 0 0 0 3px rgba(20,9,5,0.55),
      inset 0 1px 0 rgba(255,255,255,0.12);

    padding: clamp(14px, 2vw, 20px);
  }

  .quiz-panel + .quiz-panel {
    margin-top: 14px;
  }

  .quiz-panel-title {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 10px;

    color: #ffe8a2;

    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 1.3px;
    text-transform: uppercase;
  }

  .quiz-scroll {
    border: 2px solid #9c672b;

    background:
      radial-gradient(
        circle at 18% 12%,
        rgba(255,255,255,0.32),
        transparent 26%
      ),
      linear-gradient(
        180deg,
        #fff0bf,
        #dec07b
      );

    color: #2b170d;

    box-shadow:
      inset 0 0 0 2px rgba(89,48,18,0.14);

    padding: clamp(14px, 2vw, 22px);
  }

  .quiz-expression {
    display: flex;
    justify-content: center;
    align-items: center;

    min-height: 82px;

    color: #28150c;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(22px, 3vw, 34px);
    font-weight: 900;
  }

  /* =========================
     INTRO
  ========================= */

  .quiz-intro {
    width: min(850px, 100%);
    margin: 40px auto;
  }

  .quiz-intro-suri {
    height: 105px;
    width: auto;
    margin: 0 auto 10px;
    object-fit: contain;

    filter:
      drop-shadow(3px 0 0 #17100a)
      drop-shadow(-3px 0 0 #17100a)
      drop-shadow(0 12px 20px rgba(76,194,117,.38));
  }

  .quiz-badge {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 5px 10px;

    border: 2px solid #6d411c;
    border-radius: 7px;

    background:
      linear-gradient(
        180deg,
        #fff6aa,
        #ffd35c 58%,
        #c7832e
      );

    color: #321008;

    font-family: 'Nunito', sans-serif;
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .7px;
  }

  .quiz-intro-text {
    color: #3b1b6e;
    font-family: 'Nunito', sans-serif;
    font-size: clamp(17px, 2vw, 23px);
    font-weight: 900;
    line-height: 1.6;
  }

  /* =========================
     QUESTION AREA
  ========================= */

  .quiz-main {
    width: min(930px, 100%);
    margin: 0 auto;
  }

  .quiz-question {
    margin-top: 14px;
    color: #3b1b6e;
    font-family: 'Nunito', sans-serif;
    font-size: clamp(15px, 1.35vw, 18px);
    font-weight: 900;
    line-height: 1.6;
  }

  .quiz-step-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;

    padding-bottom: 10px;
    border-bottom: 2px solid rgba(255,226,136,0.18);
  }

  .quiz-step-title {
    color: #ffe8a2;

    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 900;

    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .quiz-step-rune {
    width: 48px;
    height: 48px;

    display: grid;
    place-items: center;

    border: 3px solid #725131;
    border-radius: 12px;

    background:
      linear-gradient(
        180deg,
        #69574a,
        #33271f
      );

    color: #fff6dc;

    box-shadow: 0 5px 0 #1b0f0a;

    font-family: "Bree Serif", Georgia, serif;
    font-size: 20px;
  }

  .quiz-answer-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 14px;
  }

  .quiz-answer {
    min-height: 74px;
    padding: 14px;

    border: 3px solid #6d411c;
    border-radius: 8px;

    background:
      linear-gradient(
        180deg,
        #fff4ca,
        #e7c67d
      );

    color: #28150c;

    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(18px, 2vw, 25px);
    font-weight: 900;

    box-shadow:
      0 6px 0 #28150c,
      inset 0 0 0 2px rgba(255,255,255,.24);

    transition:
      transform .12s ease,
      filter .12s ease,
      box-shadow .12s ease;
    cursor: pointer;
  }

  .quiz-answer:hover:not(:disabled) {
    transform: translateY(-3px);
    filter: brightness(1.06);
  }

  .quiz-answer:active:not(:disabled) {
    transform: translateY(4px);
    box-shadow:
      0 2px 0 #28150c,
      inset 0 0 0 2px rgba(255,255,255,.24);
  }

  .quiz-answer.selected {
    background:
      linear-gradient(
        180deg,
        #fff6aa,
        #ffd35c 58%,
        #c7832e
      );
  }

  .quiz-answer.correct {
    border-color: #ffe288;

    background:
      linear-gradient(
        180deg,
        #9df2a7 0%,
        #31a85e 55%,
        #176235 100%
      );

    color: #071d0f;

    box-shadow:
      0 6px 0 #12361e,
      0 0 24px rgba(88,255,138,.32);
  }

  .quiz-answer.wrong {
    border-color: #ff8e7c;

    background:
      linear-gradient(
        180deg,
        #7b2630,
        #351017
      );

    color: #ffd9d4;

    box-shadow:
      0 6px 0 #220a10,
      0 0 20px rgba(255,77,77,.18);
  }

  .quiz-answer.disabled {
    filter: grayscale(.65);
    opacity: .45;
    cursor: not-allowed;
  }

  /* =========================
     ACTIONS
  ========================= */

  .quiz-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    margin-top: 16px;
  }

  .quiz-action {
    min-height: 46px;
    padding: 0 15px;

    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    border: 3px solid #6d411c;
    border-radius: 8px;

    background:
      linear-gradient(
        180deg,
        #fff6aa,
        #ffd35c 58%,
        #c7832e
      );

    color: #321008;

    font-family: "Bree Serif", Georgia, serif;
    font-size: 15px;
    font-weight: 900;

    box-shadow: 0 5px 0 #28150c;

    transition:
      transform .12s ease,
      filter .12s ease;
    cursor: pointer;
  }

  .quiz-action:hover:not(:disabled) {
    transform: translateY(-2px);
    filter: brightness(1.06);
  }

  .quiz-action:active:not(:disabled) {
    transform: translateY(3px);
  }

  .quiz-action.freeze {
    background:
      linear-gradient(
        180deg,
        #dceeff,
        #82b7e8 58%,
        #4779b1
      );

    color: #102b4d;
  }

  .quiz-action.skip {
    background:
      linear-gradient(
        180deg,
        #ffb6ae,
        #e76c65 58%,
        #9f302f
      );

    color: #3b0908;
  }

  .quiz-action.save {
    background:
      linear-gradient(
        180deg,
        #fff6aa,
        #ffb84c 58%,
        #a95e20
      );
  }

  .quiz-action:disabled {
    opacity: .45;
    filter: grayscale(.5);
    cursor: not-allowed;
  }

  /* =========================
     HINT
  ========================= */

  .quiz-hint {
    margin: 16px auto 0;
    max-width: 680px;

    display: flex;
    align-items: flex-start;
    gap: 12px;

    border: 3px solid #8e5b20;

    background:
      linear-gradient(
        180deg,
        #57321d,
        #24130d
      );

    color: #f7dfad;

    box-shadow:
      0 6px 0 #160b07,
      inset 0 0 0 2px rgba(255,226,136,.12);

    padding: 14px;
  }

  .quiz-hint img {
    height: 48px;
    width: auto;
    object-fit: contain;

    filter:
      drop-shadow(2px 0 0 #17100a)
      drop-shadow(-2px 0 0 #17100a);
  }

  .quiz-hint-title {
    color: #ffe8a2;

    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1.3px;
    text-transform: uppercase;
  }

  .quiz-hint-text {
    margin-top: 4px;

    color: #f7dfad;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.5;
  }

  /* =========================
     PREVIOUS STEPS
  ========================= */

  .quiz-history {
    margin-top: 16px;

    border: 3px solid #8e5b20;

    background:
      linear-gradient(
        180deg,
        #57321d,
        #24130d
      );

    box-shadow:
      0 6px 0 #160b07,
      inset 0 0 0 2px rgba(20,9,5,.55);

    padding: 14px;
  }

  .quiz-history-title {
    display: flex;
    align-items: center;
    gap: 7px;

    color: #ffe8a2;

    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1.3px;
    text-transform: uppercase;

    padding-bottom: 9px;
    border-bottom: 2px solid rgba(255,226,136,.18);
  }

  .quiz-history-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    padding: 11px 0;

    border-bottom: 1px solid rgba(255,226,136,.12);

    color: #f7dfad;

    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 800;
  }

  .quiz-history-row:last-child {
    border-bottom: 0;
  }

  .quiz-history-answer {
    display: flex;
    align-items: center;
    gap: 8px;

    padding: 6px 9px;

    border: 2px solid #9c672b;

    background:
      linear-gradient(
        180deg,
        #fff0bf,
        #dec07b
      );

    color: #28150c;

    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 900;
  }

  /* =========================
     RESULT OVERLAY
  ========================= */

  .quiz-result-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;

    display: flex;
    align-items: center;
    justify-content: center;

    padding: 20px;

    background:
      radial-gradient(
        circle at center,
        rgba(155,67,207,.2),
        transparent 50%
      ),
      rgba(12,5,10,.78);

    backdrop-filter: blur(5px);
  }

  .quiz-result-card {
    width: min(540px, 100%);
    padding: 28px;

    border: 5px solid #5e3619;

    background:
      linear-gradient(
        180deg,
        #57321d,
        #24130d
      );

    box-shadow:
      0 10px 0 #160b07,
      0 25px 55px rgba(0,0,0,.5),
      inset 0 0 0 3px rgba(245,199,93,.28);

    text-align: center;
  }

  .quiz-result-rune {
    width: 92px;
    height: 92px;

    margin: 0 auto 18px;

    display: grid;
    place-items: center;

    border-radius: 50%;
    border: 4px solid #8749b7;

    background:
      radial-gradient(
        circle at 35% 25%,
        #fff6aa,
        #ffd35c 42%,
        #7f2cad
      );

    box-shadow:
      0 0 32px rgba(255,211,92,.52),
      0 0 42px rgba(155,67,207,.36);

    color: #32104d;
  }

  .quiz-result-title {
    color: #ffe8a2;

    font-family: "Bree Serif", Georgia, serif;
    font-size: 34px;
    text-transform: uppercase;
    letter-spacing: .5px;
  }

  .quiz-result-subtitle {
    margin-top: 8px;

    color: #f7dfad;

    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 800;
  }

  .quiz-result-value {
    display: inline-flex;
    align-items: center;
    justify-content: center;

    margin-top: 14px;
    padding: 8px 15px;

    border: 3px solid #6d411c;
    border-radius: 8px;

    background:
      linear-gradient(
        180deg,
        #fff6aa,
        #ffd35c 58%,
        #c7832e
      );

    color: #321008;

    font-family: "Bree Serif", Georgia, serif;
    font-size: 20px;

    box-shadow: 0 5px 0 #28150c;
  }

  .quiz-correct-answer {
    margin-top: 16px;

    border: 2px solid #9c672b;

    background:
      linear-gradient(
        180deg,
        #fff0bf,
        #dec07b
      );

    color: #28150c;

    padding: 12px;

    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 900;
    font-size: 22px;
  }

  /* =========================
     SUMMARY
  ========================= */

  .quiz-summary {
    width: min(780px, 100%);
    margin: 45px auto;
    text-align: center;
  }

  .quiz-summary-suri {
    height: 100px;
    width: auto;
    margin: 0 auto 5px;
    object-fit: contain;

    filter:
      drop-shadow(3px 0 0 #17100a)
      drop-shadow(-3px 0 0 #17100a)
      drop-shadow(0 12px 20px rgba(76,194,117,.38));
  }

  .quiz-summary-title {
    color: #ffe8a2;

    font-family: "Bree Serif", Georgia, serif;
    font-size: clamp(34px, 5vw, 52px);
    line-height: 1;
  }

  .quiz-summary-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 20px;
  }

  .quiz-summary-stat {
    border: 3px solid #8e5b20;

    background:
      linear-gradient(
        180deg,
        #fff0bf,
        #dec07b
      );

    color: #28150c;

    padding: 18px;

    box-shadow:
      0 6px 0 #160b07,
      inset 0 0 0 2px rgba(89,48,18,.14);
  }

  .quiz-summary-stat-label {
    color: #6c278e;

    font-family: 'Nunito', sans-serif;
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 1.3px;
  }

  .quiz-summary-stat-value {
    margin-top: 4px;

    color: #3a2111;

    font-family: "Bree Serif", Georgia, serif;
    font-size: 42px;
  }

  .quiz-feedback {
    display: flex;
    align-items: flex-start;
    gap: 12px;

    margin-top: 16px;

    border: 3px solid #8e5b20;

    background:
      linear-gradient(
        180deg,
        #57321d,
        #24130d
      );

    color: #f7dfad;

    text-align: left;

    box-shadow:
      0 6px 0 #160b07,
      inset 0 0 0 2px rgba(20,9,5,.55);

    padding: 16px;
  }

  .quiz-summary-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
    margin-top: 22px;
  }

  /* =========================
     MARKDOWN
  ========================= */

  .markdown-content p {
    margin: 0;
  }

  .markdown-content .katex {
    font-weight: 900 !important;
    color: inherit !important;
  }

  .markdown-content .katex-display {
    margin: .8rem 0 !important;
  }

  /* =========================
     MOBILE
  ========================= */

  @media (max-width: 900px) {
    .quiz-hud {
      grid-template-columns: 1fr;
    }

    .quiz-hud-right {
      justify-content: flex-start;
    }
  }

  @media (max-width: 640px) {
    .quiz-forge {
      padding: 8px;
    }

    .quiz-hud {
      padding: 16px 12px;
    }

    .quiz-title-block {
      align-items: flex-start;
    }

    .quiz-suri {
      height: 55px;
    }

    .quiz-answer-grid {
      grid-template-columns: 1fr;
    }

    .quiz-summary-stats {
      grid-template-columns: 1fr;
    }

    .quiz-history-row {
      align-items: flex-start;
      flex-direction: column;
    }
  }
`;

function ForgeRuneIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M32 5 50 15v20L32 59 14 35V15L32 5Z"
        fill="currentColor"
        opacity=".18"
      />
      <path
        d="M32 5 50 15v20L32 59 14 35V15L32 5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M32 15v34M22 24h20L24 42h18"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function QuizPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;

  const [state, setState] = useState<QuizState>("LOADING");
  const [nodeId, setNodeId] = useState<string>("");
  const [quizSessionId, setQuizSessionId] = useState<string>("");
  const [problems, setProblems] = useState<QuizProblem[]>([]);

  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);

  const currentProblemIndexRef = useRef(0);
  const currentStepIndexRef = useRef(0);

  const [timeRemainingMs, setTimeRemainingMs] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [hintText, setHintText] = useState<string | null>(null);
  const [equationRevealed, setEquationRevealed] = useState(false);
  const [isWrongAttempt, setIsWrongAttempt] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [stepAnswers, setStepAnswers] = useState<
    Record<number, { user: string; correct: string }>
  >({});

  const [stepCorrect, setStepCorrect] = useState<boolean | null>(null);
  const [correctValue, setCorrectValue] = useState<string | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0);

  const [summaryData, setSummaryData] =
    useState<QuizFinishResponse | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef<number>(0);
  const timerFrozenRef = useRef(false);
  const advanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [currentStreak, setCurrentStreak] = useState(0);
  const [streakMultiplier, setStreakMultiplier] = useState(1.0);
  const [streakAtRisk, setStreakAtRisk] = useState(0);

  const hasFetched = useRef(false);

  useEffect(() => {
    async function load() {
      if (hasFetched.current) return;
      hasFetched.current = true;

      try {
        const session = await getSession(sessionId);
        setNodeId(session.current_node);

        const data = await startQuiz({
          session_id: sessionId,
          node_id: session.current_node,
        });

        setProblems(data.problems);
        setQuizSessionId(data.quiz_session_id);
        setState("INTRO");
      } catch (err) {
        console.error(err);
        alert("Failed to start quiz. Check console.");
      }
    }

    load();
  }, [sessionId]);

  useEffect(() => {
    if (state === "STEP") {
      lastTickRef.current = Date.now();

      timerRef.current = setInterval(() => {
        const now = Date.now();
        const delta = now - lastTickRef.current;
        lastTickRef.current = now;

        setTimeRemainingMs((prev) => {
          if (timerFrozenRef.current) return prev;

          const next = prev - delta;

          if (next <= 0) return 0;

          return next;
        });
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  const currentProblem = problems[currentProblemIndex];
  const currentStep = currentProblem?.steps[currentStepIndex];

  const handleStartProblem = () => {
    setHintText(null);
    setEquationRevealed(false);
    setIsWrongAttempt(false);
    setSelectedChoice(null);
    setTimeRemainingMs(currentProblem.steps[0].timer_ms);
    setStepAnswers({});
    setState("STEP");
    timerFrozenRef.current = false;
  };

  const handleSubmit = async (choice: string | null) => {
    if (state !== "STEP") return;

    if (timerRef.current) clearInterval(timerRef.current);

    setIsSubmitting(true);

    try {
      const res = await submitQuizStep({
        quiz_session_id: quizSessionId,
        problem_id: currentProblem.id,
        step_index: currentStep.step_index,
        submitted_value: choice,
        time_remaining_ms: timeRemainingMs,
      });

      if (choice !== null) {
        setStepAnswers((prev) => ({
          ...prev,
          [currentStep.step_index]: {
            user: choice,
            correct: res.correct_value,
          },
        }));
      }

      const preWrongStreak = currentStreak;

      setTotalPoints(res.total_points);
      setCurrentStreak(res.current_streak);
      setStreakMultiplier(res.streak_multiplier);

      if (!res.correct && choice !== null) {
        setStreakAtRisk(preWrongStreak);
        setStepCorrect(false);
        setCorrectValue(res.correct_value);
        setPointsEarned(0);
        setCurrentStreak(0);
        setStreakMultiplier(1.0);
        setState("STEP_RESULT");

        advanceTimerRef.current = setTimeout(
          () => advanceToNext(),
          2500
        );

        return;
      }

      setStepCorrect(res.correct);
      setCorrectValue(res.correct_value);
      setPointsEarned(res.points_earned);
      setCurrentStreak(res.current_streak);
      setStreakMultiplier(res.streak_multiplier);
      setState("STEP_RESULT");

      setTimeout(() => advanceToNext(), 1500);
    } catch (err) {
      console.error(err);
      alert("Error submitting step.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (state !== "STEP") return;

    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const res = await skipQuizStep({
        quiz_session_id: quizSessionId,
        problem_id: currentProblem.id,
        step_index: currentStep.step_index,
      });

      setStepCorrect(false);
      setCorrectValue(res.correct_value);
      setPointsEarned(0);
      setCurrentStreak(0);
      setStreakMultiplier(1.0);
      setState("STEP_RESULT");

      setTimeout(() => advanceToNext(), 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const advanceToNext = async () => {
    const probIdx = currentProblemIndexRef.current;
    const stepIdx = currentStepIndexRef.current;
    const problem = problems[probIdx];

    if (stepIdx < problem.steps.length - 1) {
      const nextStep = problem.steps[stepIdx + 1];

      currentStepIndexRef.current = stepIdx + 1;
      setCurrentStepIndex(stepIdx + 1);

      setHintText(null);
      setIsWrongAttempt(false);
      setSelectedChoice(null);
      setTimeRemainingMs(nextStep.timer_ms);
      setState("STEP");
    } else if (probIdx < problems.length - 1) {
      currentProblemIndexRef.current = probIdx + 1;
      currentStepIndexRef.current = 0;

      setCurrentProblemIndex(probIdx + 1);
      setCurrentStepIndex(0);

      setState("INTRO");
    } else {
      setState("LOADING");

      try {
        const res = await finishQuiz({
          quiz_session_id: quizSessionId,
        });

        setSummaryData(res);
        setState("SUMMARY");
      } catch (err) {
        console.error(err);
        alert("Failed to finish quiz.");
      }
    }
  };

  const buyHint = async (type: "hint") => {
    try {
      const res = await useQuizHint({
        quiz_session_id: quizSessionId,
        problem_id: currentProblem.id,
        step_index: currentStep.step_index,
        hint_type: type,
      });

      setTotalPoints(res.total_points);

      if (type === "hint") {
        setHintText(res.hint_text);
      }
    } catch (err: any) {
      if (err.status === 400) {
        alert("Not enough points!");
      } else {
        console.error(err);
      }
    }
  };

  const requiresTextInput = (val: string) => {
    const withoutLatex = val.replace(/\\[a-zA-Z]+/g, "");
    return /[a-zA-Z]{2,}/.test(withoutLatex) ||
      withoutLatex.includes(",");
  };

  const renderMath = (
    expr: string | null | undefined,
    autoFormat: boolean = false
  ) => {
    if (!expr) return null;

    let text = expr;

    if (
      autoFormat &&
      !requiresTextInput(text) &&
      !text.includes("$")
    ) {
      text = `$${text}$`;
    }

    const inline = text.replace(
      /\$\$(.+?)\$\$/g,
      (_, inner) => `$${inner}$`
    );

    const clean = inline
      .replace(
        /(\d)\s*\*\*\s*([a-zA-Z])/g,
        "$1$2"
      )
      .replace(
        /([a-zA-Z])\s*\*\*\s*([a-zA-Z])/g,
        "$1$2"
      );

    return (
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {clean}
      </ReactMarkdown>
    );
  };

  /* =========================
     LOADING
  ========================= */

  if (state === "LOADING") {
    return (
      <div className="quiz-forge flex flex-col items-center justify-center">
        <style dangerouslySetInnerHTML={{ __html: QUIZ_CSS }} />

        <div className="quiz-card max-w-sm w-full text-center">
          <div className="quiz-panel">
            <img
              src="/suri-snake-left.png"
              alt="Suri"
              className="quiz-intro-suri"
            />

            <div className="relative w-12 h-12 mx-auto mb-5">
              <div className="absolute inset-0 border-4 border-[#6d411c] rounded-full" />
              <div className="absolute inset-0 border-4 border-[#ffe288] border-t-[#8749b7] rounded-full animate-spin" />
            </div>

            <p className="quiz-panel-title justify-center w-full animate-pulse">
              Loading Quiz...
            </p>

            <p className="quiz-hint-text">
              Suri is preparing the next challenge.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* =========================
     INTRO
  ========================= */

  if (state === "INTRO") {
    return (
      <div className="quiz-forge">
        <style dangerouslySetInnerHTML={{ __html: QUIZ_CSS }} />

        <div className="quiz-shell">
          <header className="quiz-hud">
            <div className="quiz-title-block">
              <img
                src="/suri-snake-left.png"
                alt="Suri Guide"
                className="quiz-suri select-none shrink-0"
              />

              <div>
                <span className="quiz-eyebrow">
                  Guided Quiz Challenge
                </span>

                <h1 className="quiz-title">
                  Rune Challenge
                </h1>

                <p className="quiz-subtitle">
                  Problem {currentProblemIndex + 1} of {problems.length}
                  {" "} | {" "}
                  Stabilize each rune before the timer runs out
                </p>
              </div>
            </div>

            <div className="quiz-hud-right">
              <button
                onClick={() =>
                  router.push(`/session/${sessionId}/lesson`)
                }
                className="quiz-exit"
              >
                Exit
              </button>
            </div>
          </header>

          <main className="quiz-intro">
            <div className="quiz-card">
              <div className="quiz-panel text-center">
                <span className="quiz-badge">
                  <BookOpen className="w-4 h-4 mr-1" />
                  Quest Problem {currentProblemIndex + 1}
                </span>

                <div className="quiz-scroll mt-4">
                  <div className="quiz-intro-text markdown-content">
                    {renderMath(
                      currentProblem.word_problem_text || ""
                    )}
                  </div>
                </div>

                <button
                  onClick={handleStartProblem}
                  className="quiz-action w-full mt-5"
                  style={{
                    minHeight: "60px",
                    fontSize: "21px",
                  }}
                >
                  Begin Rune Challenge
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  /* =========================
     STEP + RESULT
  ========================= */

  if (state === "STEP" || state === "STEP_RESULT") {
    const progressPct =
      currentStep && currentStep.timer_ms
        ? (timeRemainingMs / currentStep.timer_ms) * 100
        : 0;

    return (
      <div className="quiz-forge">
        <style dangerouslySetInnerHTML={{ __html: QUIZ_CSS }} />

        <div className="quiz-shell">

          {/* HUD */}

          <header className="quiz-hud">
            <div className="quiz-title-block">
              <img
                src="/suri-snake-left.png"
                alt="Suri Guide"
                className="quiz-suri select-none shrink-0"
              />

              <div>
                <span className="quiz-eyebrow">
                  Rune Forging Challenge
                </span>

                <h1 className="quiz-title">
                  Solve the Rune
                </h1>

                <p className="quiz-subtitle">
                  Problem {currentProblemIndex + 1} of {problems.length}
                  {" "} • {" "}
                  Step {currentStepIndex + 1} of {currentProblem.steps.length}
                </p>
              </div>
            </div>

            <div className="quiz-hud-right">
              <div className="quiz-stat">
                ✦ {totalPoints} pts
              </div>

              <div className="quiz-stat streak">
                <Flame className="w-4 h-4" />
                {currentStreak}
                {streakMultiplier > 1 && (
                  <span>{streakMultiplier}×</span>
                )}
              </div>

              <div className="quiz-stat timer">
                <Timer className="w-4 h-4" />
                {(timeRemainingMs / 1000).toFixed(1)}s
              </div>

              <button
                onClick={() =>
                  router.push(`/session/${sessionId}/lesson`)
                }
                className="quiz-exit"
              >
                Exit
              </button>
            </div>
          </header>

          {/* TIMER */}

          <div className="quiz-timer-track">
            <div
              className="quiz-timer-fill"
              style={{
                width: `${Math.max(0, progressPct)}%`,
              }}
            />
          </div>

          {/* MAIN */}

          <main className="quiz-main">

            {/* Optional equation */}

            {equationRevealed && (
              <section className="quiz-panel">
                <div className="quiz-panel-title">
                  <Sparkles className="w-4 h-4" />
                  Problem Equation
                </div>

                <div className="quiz-scroll quiz-expression markdown-content">
                  {renderMath(currentProblem.problem_expr)}
                </div>
              </section>
            )}

            {/* Quest Context */}

            <section className="quiz-panel">
              <div className="quiz-panel-title">
                <BookOpen className="w-4 h-4" />
                Quest Context
              </div>

              <div className="quiz-scroll quiz-question markdown-content">
                {renderMath(
                  currentProblem.word_problem_text || ""
                )}
              </div>
            </section>

            {/* Current Rune */}

            <section className="quiz-panel">
              <div className="quiz-step-header">
                <div className="flex items-center gap-3">
                  <div className="quiz-step-rune">
                    <ForgeRuneIcon className="w-7 h-7" />
                  </div>

                  <div>
                    <div className="quiz-step-title">
                      Rune {currentStepIndex + 1}
                    </div>

                    <span className="quiz-badge">
                      Algebraic Step
                    </span>
                  </div>
                </div>

                <span className="quiz-badge">
                  {timeRemainingMs > 0
                    ? "Rune Active"
                    : "Rune Expired"}
                </span>
              </div>

            

              {/* Expression */}

              <div className="quiz-scroll quiz-expression markdown-content mt-3">
                {renderMath(
                  currentStep.blank_expression.replace(
                    "?",
                    "\\_\\_\\_"
                  ),
                  true
                )}
              </div>

              {/* Choices */}

              <div className="quiz-answer-grid">
                {currentStep.choices.map((choice, idx) => {
                  const isSelected = selectedChoice === choice;

                  let className =
                    "quiz-answer";

                  if (isSelected) {
                    className += " selected";
                  }

                  if (
                    isSelected &&
                    state === "STEP_RESULT" &&
                    stepCorrect
                  ) {
                    className += " correct";
                  }

                  if (
                    isSelected &&
                    state === "STEP_RESULT" &&
                    !stepCorrect
                  ) {
                    className += " wrong";
                  }

                  if (
                    state === "STEP_RESULT" ||
                    isSubmitting
                  ) {
                    className += " disabled";
                  }

                  return (
                    <button
                      key={idx}
                      disabled={
                        state === "STEP_RESULT" ||
                        isSubmitting
                      }
                      onClick={() => {
                        setSelectedChoice(choice);
                        handleSubmit(choice);
                      }}
                      className={className}
                    >
                      <div className="markdown-content">
                        {renderMath(choice, true)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Actions */}

            <div className="quiz-actions">
              <button
                onClick={() => buyHint("hint")}
                disabled={
                  hintText !== null ||
                  state === "STEP_RESULT" ||
                  isSubmitting
                }
                className="quiz-action"
              >
                <Lightbulb className="w-4 h-4" />
                Hint · 750 pts
              </button>

              <button
                onClick={async () => {
                  if (totalPoints < 750) {
                    alert("Not enough points!");
                    return;
                  }

                  timerFrozenRef.current = true;

                  setTimeout(() => {
                    timerFrozenRef.current = false;
                  }, 10_000);

                  try {
                    const res = await useQuizHint({
                      quiz_session_id: quizSessionId,
                      problem_id: currentProblem.id,
                      step_index: currentStep.step_index,
                      hint_type: "freeze",
                    });

                    setTotalPoints(res.total_points);
                  } catch (err: any) {
                    timerFrozenRef.current = false;
                    alert("Not enough points!");
                  }
                }}
                disabled={
                  timerFrozenRef.current ||
                  state === "STEP_RESULT" ||
                  isSubmitting
                }
                className="quiz-action freeze"
              >
                <Snowflake className="w-4 h-4" />
                Freeze Timer · 750 pts
              </button>

              {timeRemainingMs === 0 && (
                <button
                  onClick={handleSkip}
                  disabled={
                    state === "STEP_RESULT" ||
                    isSubmitting
                  }
                  className="quiz-action skip"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip Rune
                </button>
              )}
            </div>

            {/* Hint */}

            {hintText && (
              <div className="quiz-hint">
                <img
                  src="/suri-snake-left.png"
                  alt="Suri"
                />

                <div>
                  <div className="quiz-hint-title">
                    Suri ss-says:
                  </div>

                  <div className="quiz-hint-text">
                    {hintText}
                  </div>
                </div>
              </div>
            )}

            {/* Previous Steps */}

            {currentStepIndex > 0 && (
              <section className="quiz-history">
                <div className="quiz-history-title">
                  <Flame className="w-4 h-4" />
                  Previously Forged Runes
                </div>

                {currentProblem.steps
                  .slice(0, currentStepIndex)
                  .reverse()
                  .map((s, idx) => {
                    const filledExpr =
                      s.blank_expression.replace(
                        "?",
                        s.correct_value
                      );

                    const userAnswer =
                      stepAnswers[s.step_index]?.user;

                    const correctAnswer =
                      stepAnswers[s.step_index]?.correct;

                    const isCorrect =
                      userAnswer !== undefined &&
                      correctAnswer !== undefined &&
                      userAnswer.trim().toLowerCase() ===
                        correctAnswer.trim().toLowerCase();

                    return (
                      <div
                        key={idx}
                        className="quiz-history-row"
                      >
                        <span className="markdown-content">
                          {renderMath(s.instruction)}
                        </span>

                        <div className="flex flex-col gap-2">
                          <div className="quiz-history-answer">
                            <span className="text-[9px] uppercase">
                              Question:
                            </span>

                            {renderMath(
                              filledExpr,
                              true
                            )}
                          </div>

                          {userAnswer !== undefined && (
                            <div className="quiz-history-answer">
                              <span className="text-[9px] uppercase">
                                Your Answer:
                              </span>

                              <span
                                className={
                                  isCorrect
                                    ? "text-green-700"
                                    : "text-red-700"
                                }
                              >
                                {renderMath(
                                  userAnswer,
                                  true
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </section>
            )}
          </main>

          {/* RESULT OVERLAY */}

          {state === "STEP_RESULT" && (
            <div className="quiz-result-overlay">
              <div className="quiz-result-card">

                <div
                  className="quiz-result-rune"
                  style={{
                    borderColor: stepCorrect
                      ? "#ffe288"
                      : "#ff8e7c",
                  }}
                >
                  {stepCorrect ? (
                    <CheckCircle2 className="w-14 h-14" />
                  ) : (
                    <XCircle className="w-14 h-14" />
                  )}
                </div>

                {stepCorrect ? (
                  <>
                    <h2 className="quiz-result-title">
                      Rune Stabilized!
                    </h2>

                    <p className="quiz-result-subtitle">
                      Excellent work. The algebraic pattern
                      is holding strong.
                    </p>

                    <div className="quiz-result-value">
                      +{pointsEarned} pts
                    </div>

                    {currentStreak >= 2 && (
                      <div className="mt-4 flex items-center justify-center gap-2">
                        <Flame className="w-5 h-5 text-orange-400" />

                        <span className="font-black text-[#ffe8a2] text-sm uppercase tracking-wider">
                          {currentStreak} streak ·{" "}
                          {streakMultiplier}×
                        </span>
                      </div>
                    )}

                    {currentStreak === 1 && (
                      <p className="mt-4 text-xs font-black text-[#f7dfad] uppercase tracking-widest">
                        Streak started — keep going!
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <h2 className="quiz-result-title">
                      Rune Unstable
                    </h2>

                    <p className="quiz-result-subtitle">
                      The pattern needs another look. Suri
                      has marked the stable answer below.
                    </p>

                    <div className="mt-4 text-[10px] font-black text-[#ffe8a2] uppercase tracking-widest">
                      Stable Pattern
                    </div>

                    <div className="quiz-correct-answer markdown-content">
                      {renderMath(
                        correctValue || "",
                        true
                      )}
                    </div>

                    {!stepCorrect && streakAtRisk > 0 && (
                      <button
                        onClick={async () => {
                          if (advanceTimerRef.current) {
                            clearTimeout(
                              advanceTimerRef.current
                            );
                          }

                          try {
                            const res =
                              await useQuizHint({
                                quiz_session_id:
                                  quizSessionId,
                                problem_id:
                                  currentProblem.id,
                                step_index:
                                  currentStep.step_index,
                                hint_type:
                                  "save_streak",
                                saved_streak:
                                  streakAtRisk,
                              });

                            setTotalPoints(
                              res.total_points
                            );

                            setCurrentStreak(
                              streakAtRisk
                            );

                            const mult =
                              Math.round(
                                (
                                  1.0 +
                                  Math.max(
                                    0,
                                    streakAtRisk - 1
                                  ) *
                                    0.1
                                ) * 100
                              ) / 100;

                            setStreakMultiplier(mult);
                            setStreakAtRisk(0);
                          } catch (err: any) {
                            console.log(
                              "save streak error:",
                              err
                            );

                            alert(
                              "Not enough points!"
                            );
                          }

                          advanceTimerRef.current =
                            setTimeout(
                              () => advanceToNext(),
                              1500
                            );
                        }}
                        className="quiz-action save mt-5 mx-auto"
                      >
                        <Flame className="w-4 h-4" />
                        Save Streak · 1000 pts
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* =========================
     SUMMARY
  ========================= */

  if (state === "SUMMARY" && summaryData) {
    const { progression } = summaryData;

    const accuracy = Math.round(
      (summaryData.total_correct /
        Math.max(1, summaryData.total_steps)) *
        100
    );

    return (
      <div className="quiz-forge">
        <style dangerouslySetInnerHTML={{ __html: QUIZ_CSS }} />

        <div className="quiz-shell">
          <main className="quiz-summary">
            <div className="quiz-card">
              <div className="quiz-panel">

                <img
                  src="/suri-snake-happy.png"
                  alt="Suri"
                  className="quiz-summary-suri"
                />

                <span className="quiz-badge">
                  <Sparkles className="w-4 h-4 mr-1" />
                  Quest Complete
                </span>

                <h1 className="quiz-summary-title mt-4">
                  Quiz Complete!
                </h1>

                <p className="quiz-subtitle">
                  The rune chain has been forged.
                </p>

                <div className="quiz-summary-stats">
                  <div className="quiz-summary-stat">
                    <div className="quiz-summary-stat-label">
                      Final Score
                    </div>

                    <div className="quiz-summary-stat-value">
                      {summaryData.total_points}
                    </div>
                  </div>

                  <div className="quiz-summary-stat">
                    <div className="quiz-summary-stat-label">
                      Accuracy
                    </div>

                    <div className="quiz-summary-stat-value">
                      {accuracy}%
                    </div>
                  </div>
                </div>

                <div className="quiz-feedback">
                  <img
                    src="/suri-snake-left.png"
                    alt="Suri"
                    className="h-14 w-auto object-contain shrink-0"
                  />

                  <div>
                    <div className="quiz-hint-title mb-2">
                      Suri ss-says:
                    </div>

                    <p className="text-sm leading-relaxed font-bold">
                      {summaryData.feedback_text}
                    </p>
                  </div>
                </div>

                <div className="quiz-summary-actions">
                  {progression.topic_complete ? (
                    <button
                      onClick={() =>
                        router.push("/topics")
                      }
                      className="quiz-action"
                      style={{
                        minHeight: "56px",
                        padding: "0 28px",
                      }}
                    >
                      Return to Dashboard
                    </button>
                  ) : progression.decision ===
                      "advance" &&
                    progression.next_node_id ? (
                    <button
                      onClick={() =>
                        router.push(
                          `/session/${sessionId}/lesson`
                        )
                      }
                      className="quiz-action"
                      style={{
                        minHeight: "56px",
                        padding: "0 28px",
                      }}
                    >
                      Next Lesson
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  ) : progression.go_deeper_available &&
                    progression.go_deeper_node ? (
                    <button
                      onClick={() =>
                        router.push(
                          `/session/${sessionId}/lesson`
                        )
                      }
                      className="quiz-action"
                      style={{
                        minHeight: "56px",
                        padding: "0 28px",
                      }}
                    >
                      Review Basics
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        router.push(
                          `/session/${sessionId}/lesson`
                        )
                      }
                      className="quiz-action"
                      style={{
                        minHeight: "56px",
                        padding: "0 28px",
                      }}
                    >
                      Review Lesson
                    </button>
                  )}

                  <button
                    onClick={() =>
                      router.push(
                        `/session/${sessionId}/lesson`
                      )
                    }
                    className="quiz-action skip"
                    style={{
                      minHeight: "56px",
                      padding: "0 28px",
                    }}
                  >
                    Exit Quiz
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return null;
}
