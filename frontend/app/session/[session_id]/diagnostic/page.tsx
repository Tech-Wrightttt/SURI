"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "react-hot-toast";
import confetti from "canvas-confetti";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import {
  getSession,
  getTopicChain,
  getDiagnosticProbe,
  submitDiagnosticAnswer,
  submitDiagnostic,
  skipDiagnostic,
  DiagnosticProbe,
} from "../../../../lib/api";

const GAME_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800;900&display=swap');
  :root {
    --void-dark: #0a0010; --void-purple: #2d0a4e; --glow-purple: #9b59b6;
    --glow-red: #e74c3c; --glow-gold: #f9c31f; --glow-green: #3dbf6e;
    --heart-red: #ff2244; --heart-empty: #3a1a2a;
  }
  * { box-sizing: border-box; }
  .battle-body { font-family: 'Nunito', sans-serif; min-height: 100vh; overflow-x: hidden; position: relative; background: #0a0010; display: flex; flex-direction: column; }
  .arena-bg { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
  .arena-sky { position: absolute; inset: 0; background: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(100,0,180,0.7) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 20% 30%, rgba(150,0,80,0.4) 0%, transparent 60%), linear-gradient(180deg, #0d0018 0%, #1a0030 25%, #200015 50%, #080010 100%); }
  .arena-floor { position: absolute; bottom: 0; left: 0; right: 0; height: 38%; background: linear-gradient(180deg, transparent 0%, rgba(60,0,100,0.35) 100%); }
  .arena-floor-line { position: absolute; bottom: 34%; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, transparent 0%, rgba(155,89,182,0.7) 40%, rgba(230,180,255,0.9) 50%, rgba(155,89,182,0.7) 60%, transparent 100%); box-shadow: 0 0 20px 4px rgba(155,89,182,0.5), 0 0 60px 10px rgba(155,89,182,0.2); }
  .fog-wisp { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(40px); animation: fogDrift linear infinite; opacity: 0; }
  @keyframes fogDrift { 0% { opacity: 0; transform: translateX(-60px) scaleX(0.8); } 20% { opacity: 0.18; } 80% { opacity: 0.12; } 100% { opacity: 0; transform: translateX(80px) scaleX(1.2); } }
  .pillar { position: absolute; bottom: 32%; width: 48px; border-radius: 6px 6px 0 0; background: linear-gradient(180deg, #1c0c2e 0%, #2a1040 30%, #100618 100%); border: 1px solid rgba(155,89,182,0.2); box-shadow: inset 2px 0 6px rgba(0,0,0,0.6), inset -2px 0 6px rgba(0,0,0,0.6); }
  .pillar::before { content: ''; position: absolute; top: -14px; left: -6px; right: -6px; height: 14px; background: linear-gradient(180deg, #3a1a5a, #2a1040); border-radius: 4px 4px 0 0; border: 1px solid rgba(155,89,182,0.3); box-shadow: 0 -4px 12px rgba(155,89,182,0.2); }
  .pillar::after { content: ''; position: absolute; bottom: 0; left: -4px; right: -4px; height: 20px; background: linear-gradient(180deg, #2a1040, #1c0828); border-radius: 2px; }
  .skull-deco { position: absolute; pointer-events: none; opacity: 0.25; animation: skullBob 4s ease-in-out infinite; filter: drop-shadow(0 0 6px rgba(155,89,182,0.4)); }
  @keyframes skullBob { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-8px) rotate(3deg); } }
  @keyframes emberRise { 0% { transform: translate(0,0) scale(1); opacity: 0.8; } 50% { transform: translate(var(--ex),-60px) scale(0.7); opacity: 0.6; } 100% { transform: translate(var(--ex2),-130px) scale(0.3); opacity: 0; } }
  .ember { position: absolute; border-radius: 50%; pointer-events: none; background: radial-gradient(circle,#fff 0%,#ffaa00 40%,#ff4400 80%,transparent 100%); animation: emberRise ease-out infinite; filter: blur(0.5px); }
  @keyframes fireflyMove { 0% { transform: translate(0,0) scale(0.7); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 0.8; } 100% { transform: translate(var(--ftx),var(--fty)) scale(1.2); opacity: 0; } }
  .firefly { position: absolute; border-radius: 50%; pointer-events: none; background: radial-gradient(circle,#ffd700 0%,#ff9500 60%,transparent 100%); animation: fireflyMove linear infinite; filter: blur(1px); }
  .hud-bar { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 8px 20px; background: linear-gradient(180deg,rgba(10,0,20,0.98) 0%,rgba(15,0,30,0.92) 100%); border-bottom: 2px solid rgba(155,89,182,0.4); box-shadow: 0 4px 20px rgba(0,0,0,0.8); backdrop-filter: blur(10px); flex-shrink: 0; }
  .hud-brand { display: flex; align-items: center; gap: 10px; }
  .hud-logo { font-family: 'Fredoka One', cursive; font-size: 20px; color: #fff; text-shadow: 0 0 10px rgba(155,89,182,0.8); letter-spacing: 2px; }
  .hud-tag { background: rgba(155,89,182,0.25); border: 1px solid rgba(155,89,182,0.5); border-radius: 8px; padding: 3px 10px; font-size: 10px; font-weight: 800; color: #c49a6c; text-transform: uppercase; letter-spacing: 2px; }
  .hud-center { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
  .hud-progress-text { font-family: 'Fredoka One', cursive; color: rgba(255,255,255,0.7); font-size: 13px; white-space: nowrap; }
  .hud-progress-bar { width: 80px; height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; border: 1px solid rgba(155,89,182,0.3); overflow: hidden; }
  .hud-progress-fill { height: 100%; background: linear-gradient(90deg,#9b59b6,#c39bd3); border-radius: 4px; transition: width 0.5s ease; box-shadow: 0 0 8px rgba(155,89,182,0.6); }
  .hud-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .streak-pill { display: flex; align-items: center; gap: 4px; background: rgba(231,76,60,0.2); border: 1px solid rgba(231,76,60,0.5); border-radius: 14px; padding: 4px 10px; font-family: 'Fredoka One', cursive; color: #ff8c69; font-size: 14px; }
  .score-chip { display: flex; align-items: center; gap: 6px; background: linear-gradient(135deg,#f9d71c,#e8a21a); border: 2px solid #5c3a1e; border-radius: 20px; padding: 5px 12px; font-family: 'Fredoka One', cursive; color: #5c3a1e; font-size: 16px; box-shadow: 0 3px 0 #9a5c08; letter-spacing: 1px; }
  .battle-layout { flex: 1; display: flex; flex-direction: column; position: relative; z-index: 1; min-height: 0; }
  .arena-section { display: flex; align-items: flex-end; justify-content: center; gap: 0; padding: 24px 32px 0; min-height: 280px; position: relative; }
  .char-container { display: flex; flex-direction: column; align-items: center; gap: 10px; position: relative; z-index: 10; }
  .char-container.suri-side { align-items: flex-start; flex: 1; max-width: 320px; }
  .char-container.enemy-side { align-items: flex-end; flex: 1; max-width: 320px; }
  .name-plate { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; }
  .char-name { font-family: 'Fredoka One', cursive; font-size: 16px; text-shadow: 1px 1px 0 rgba(0,0,0,0.8); letter-spacing: 1px; }
  .char-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; opacity: 0.7; }
  .hearts-bar { display: flex; gap: 6px; align-items: center; justify-content: center; padding: 6px 12px; background: rgba(0,0,0,0.5); border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(4px); }
  .heart-icon { flex-shrink: 0; transition: all 0.3s; filter: drop-shadow(0 0 6px rgba(255,34,68,0.8)); }
  .heart-icon.empty { opacity: 0.2; filter: grayscale(1); }
  @keyframes heartBreak { 0% { transform: scale(1.5) rotate(-8deg); filter: drop-shadow(0 0 16px #ff2244) brightness(2); } 25% { transform: scale(0.8) rotate(12deg); } 50% { transform: scale(1.2) rotate(-5deg); } 100% { transform: scale(1) rotate(0); opacity: 0.2; filter: grayscale(1); } }
  .heart-breaking { animation: heartBreak 0.7s ease-out forwards; }
  .sprite-frame { position: relative; display: flex; align-items: flex-end; justify-content: center; }
  .suri-sprite { height: 200px; width: auto; object-fit: contain; filter: drop-shadow(0 8px 20px rgba(61,191,110,0.5)); transform-origin: bottom center; transition: filter 0.2s; }
  @media (max-width: 700px) { .suri-sprite { height: 130px; } }
  @keyframes suriAttack { 0% { transform: translateX(0) scaleX(1); } 20% { transform: translateX(40px) scaleX(1.15) skewX(-5deg); filter: drop-shadow(0 0 20px #3dbf6e) brightness(1.4); } 45% { transform: translateX(80px) scaleX(1.2) skewX(-8deg); filter: drop-shadow(0 0 30px #3dbf6e) brightness(1.6); } 70% { transform: translateX(20px) scaleX(1.05); } 100% { transform: translateX(0) scaleX(1); filter: drop-shadow(0 8px 20px rgba(61,191,110,0.5)); } }
  .suri-attacking { animation: suriAttack 0.75s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
  @keyframes suriHit { 0% { transform: translateX(0); } 15% { transform: translateX(-30px) scaleX(0.9); filter: brightness(2.5) saturate(0) drop-shadow(0 0 20px #ff2244); } 55% { transform: translateX(-25px) scaleX(0.95); } 100% { transform: translateX(0) scaleX(1); filter: drop-shadow(0 8px 20px rgba(61,191,110,0.5)); } }
  .suri-hit { animation: suriHit 0.7s ease-out forwards; }
  @keyframes suriIdle { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  .suri-idle { animation: suriIdle 2.8s ease-in-out infinite; }
  @keyframes suriDefeat { 0% { transform: translateY(0) rotate(0); } 40% { transform: translateY(-10px) rotate(-8deg); filter: brightness(0.6) saturate(0.3); } 100% { transform: translateY(6px) rotate(-12deg); filter: brightness(0.5) saturate(0); opacity: 0.7; } }
  .suri-defeated-anim { animation: suriDefeat 0.8s ease-out forwards; }
  .enemy-sprite { width: 200px; height: 200px; object-fit: cover; border-radius: 50%; border: 4px solid #6c3483; box-shadow: 0 0 30px rgba(108,52,131,0.7), 0 0 60px rgba(108,52,131,0.3); filter: drop-shadow(0 0 20px rgba(108,52,131,0.6)); transform-origin: bottom center; }
  @media (max-width: 700px) { .enemy-sprite { width: 130px; height: 130px; } }
  @keyframes enemyIdle { 0%,100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-6px) rotate(-1.5deg); } 75% { transform: translateY(-4px) rotate(1.5deg); } }
  .enemy-idle { animation: enemyIdle 2.5s ease-in-out infinite; }
  @keyframes enemyHit { 0% { transform: translateX(0) scale(1); } 10% { transform: translateX(30px) scale(1.08); filter: brightness(3) saturate(0); } 25% { transform: translateX(-20px) scale(0.94); filter: brightness(2) hue-rotate(30deg); } 55% { transform: translateX(-10px) scale(0.98); } 100% { transform: translateX(0) scale(1); filter: brightness(1); } }
  .enemy-hit { animation: enemyHit 0.65s ease-out forwards; }
  @keyframes enemyAttack { 0% { transform: translateX(0) scale(1); } 20% { transform: translateX(-50px) scale(1.15); filter: brightness(1.8) hue-rotate(-20deg); } 45% { transform: translateX(-90px) scale(1.2); filter: brightness(2) drop-shadow(0 0 20px #e74c3c); } 100% { transform: translateX(0) scale(1); filter: brightness(1); } }
  .enemy-attacking { animation: enemyAttack 0.8s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
  @keyframes enemyAppear { 0% { transform: scale(0) rotate(-30deg); opacity: 0; filter: brightness(3); } 60% { transform: scale(1.18) rotate(5deg); opacity: 1; } 100% { transform: scale(1) rotate(0); opacity: 1; filter: brightness(1); } }
  .enemy-appear { animation: enemyAppear 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards; }
  @keyframes enemyDefeated { 0% { transform: scale(1) rotate(0); opacity: 1; } 20% { transform: scale(1.2) rotate(-10deg); filter: brightness(3) saturate(0.5); } 100% { transform: scale(0) rotate(400deg); opacity: 0; } }
  .enemy-defeated-anim { animation: enemyDefeated 1s ease-in forwards; }
  .vs-divider { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 40px; gap: 10px; z-index: 10; flex-shrink: 0; width: 80px; }
  .vs-badge { background: linear-gradient(135deg,#f9d71c,#e8a21a); border: 3px solid #5c3a1e; border-radius: 50%; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; font-family: 'Fredoka One', cursive; font-size: 18px; color: #5c3a1e; box-shadow: 0 4px 0 #9a5c08, 0 0 20px rgba(249,199,31,0.5); animation: vsGlow 2s ease-in-out infinite; flex-shrink: 0; }
  @keyframes vsGlow { 0%,100% { box-shadow: 0 4px 0 #9a5c08, 0 0 20px rgba(249,199,31,0.5); } 50% { box-shadow: 0 4px 0 #9a5c08, 0 0 40px rgba(249,199,31,0.8); } }
  @keyframes dmgPop { 0% { opacity: 1; transform: translate(-50%,0) scale(1.4); } 40% { opacity: 1; transform: translate(-50%,-30px) scale(1); } 100% { opacity: 0; transform: translate(-50%,-80px) scale(0.6); } }
  .dmg-number { position: absolute; pointer-events: none; z-index: 200; font-family: 'Fredoka One', cursive; font-size: 36px; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); animation: dmgPop 0.9s ease-out forwards; left: 50%; top: 10%; white-space: nowrap; }
  .dmg-enemy { color: #ff4757; } .dmg-suri { color: #ff8c69; }
  @keyframes screenShake { 0%,100% { transform: translate(0,0); } 10% { transform: translate(-6px,-3px); } 20% { transform: translate(6px,3px); } 30% { transform: translate(-4px,2px); } 50% { transform: translate(-3px,1px); } 70% { transform: translate(-2px,1px); } 90% { transform: translate(-1px,0); } }
  .screen-shake { animation: screenShake 0.45s ease-out; }
  .battle-panel { position: relative; z-index: 10; margin: 12px 20px 20px; display: flex; flex-direction: column; gap: 12px; }
  @media (min-width: 900px) { .battle-panel { margin: 12px 60px 28px; } }
  .question-scroll { background: linear-gradient(160deg,rgba(20,5,40,0.95) 0%,rgba(15,3,30,0.98) 100%); border: 2px solid rgba(155,89,182,0.5); border-radius: 20px; padding: 16px 20px; position: relative; box-shadow: 0 8px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(155,89,182,0.2); backdrop-filter: blur(10px); }
  .question-scroll::before { content: ''; position: absolute; inset: 0; border-radius: 20px; background: radial-gradient(ellipse at 50% 0%,rgba(155,89,182,0.1) 0%,transparent 70%); pointer-events: none; }
  .question-badge { display: inline-flex; align-items: center; gap: 6px; background: linear-gradient(135deg,rgba(155,89,182,0.3),rgba(108,52,131,0.4)); border: 1px solid rgba(155,89,182,0.5); border-radius: 10px; padding: 4px 12px; font-family: 'Fredoka One', cursive; font-size: 11px; color: #c39bd3; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; }
  .question-text { font-family: 'Nunito', sans-serif; font-weight: 800; color: #f0e8ff; font-size: 17px; line-height: 1.6; margin: 0; }
  @media (max-width: 600px) { .question-text { font-size: 15px; } }
  .spell-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 480px) { .spell-grid { grid-template-columns: 1fr; gap: 8px; } }
  .spell-tile { position: relative; border-radius: 14px; border: 2px solid rgba(155,89,182,0.3); cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s; overflow: hidden; user-select: none; background: linear-gradient(160deg,rgba(30,10,55,0.9) 0%,rgba(20,5,40,0.95) 100%); padding: 12px 14px; }
  .spell-tile::before { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg,rgba(255,255,255,0.05) 0%,transparent 100%); border-radius: inherit; pointer-events: none; }
  .spell-tile:hover:not(.locked):not(.selected) { transform: translateY(-4px) scale(1.02); border-color: rgba(155,89,182,0.7); box-shadow: 0 8px 20px rgba(0,0,0,0.6), 0 0 20px rgba(155,89,182,0.3); }
  .spell-tile:active:not(.locked) { transform: translateY(1px) scale(0.98); }
  .spell-tile.selected { border-color: rgba(200,150,255,0.8); box-shadow: 0 0 0 2px rgba(155,89,182,0.4); transform: translateY(-2px); animation: selectedSpell 1.5s ease-in-out infinite; }
  @keyframes selectedSpell { 0%,100% { box-shadow: 0 0 0 2px rgba(155,89,182,0.4); } 50% { box-shadow: 0 0 0 4px rgba(155,89,182,0.2), 0 0 20px rgba(155,89,182,0.3); } }
  .spell-tile.locked { cursor: default; opacity: 0.75; }
  .spell-tile.correct-reveal { background: linear-gradient(160deg,rgba(30,90,50,0.95),rgba(15,60,30,0.98)) !important; border-color: #3dbf6e !important; box-shadow: 0 0 20px rgba(61,191,110,0.5) !important; }
  .spell-tile.wrong-reveal { background: linear-gradient(160deg,rgba(90,20,20,0.95),rgba(60,10,10,0.98)) !important; border-color: #e74c3c !important; box-shadow: 0 0 20px rgba(231,76,60,0.5) !important; }
  .spell-label { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; background: rgba(155,89,182,0.3); border: 1px solid rgba(155,89,182,0.5); border-radius: 8px; font-family: 'Fredoka One', cursive; font-size: 16px; color: #c39bd3; flex-shrink: 0; margin-bottom: 6px; }
  .spell-text { font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 13px; color: rgba(255,255,255,0.92); line-height: 1.4; word-break: break-word; }
  .spell-check { position: absolute; top: 8px; right: 8px; width: 20px; height: 20px; background: rgba(200,150,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; z-index: 10; color: #2d0a4e; font-weight: 900; }
  @keyframes tileIn { 0% { opacity: 0; transform: translateY(24px) scale(0.88); } 60% { transform: translateY(-4px) scale(1.03); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
  .spell-tile-enter { animation: tileIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; opacity: 0; }
  .spell-tile-enter:nth-child(1) { animation-delay: 0.00s; }
  .spell-tile-enter:nth-child(2) { animation-delay: 0.07s; }
  .spell-tile-enter:nth-child(3) { animation-delay: 0.14s; }
  .spell-tile-enter:nth-child(4) { animation-delay: 0.21s; }
  @keyframes feedbackIn { 0% { opacity: 0; transform: translateY(12px) scale(0.9); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
  .feedback-banner { border-radius: 16px; padding: 12px 16px; display: flex; align-items: center; gap: 12px; animation: feedbackIn 0.35s ease-out forwards; border: 2px solid rgba(0,0,0,0.2); }
  .feedback-banner.correct { background: linear-gradient(135deg,rgba(30,80,50,0.97),rgba(20,60,35,0.99)); border-color: rgba(61,191,110,0.6); box-shadow: 0 4px 0 rgba(15,50,25,0.8), 0 0 20px rgba(61,191,110,0.2); }
  .feedback-banner.wrong { background: linear-gradient(135deg,rgba(80,15,15,0.97),rgba(60,8,8,0.99)); border-color: rgba(231,76,60,0.6); box-shadow: 0 4px 0 rgba(50,5,5,0.8), 0 0 20px rgba(231,76,60,0.2); }
  .feedback-title { font-family: 'Fredoka One', cursive; font-size: 16px; color: #fff; margin-bottom: 3px; }
  .feedback-quote { font-family: 'Nunito', sans-serif; font-weight: 700; font-size: 12px; color: rgba(255,255,255,0.8); font-style: italic; margin: 0; }
  .feedback-suri { height: 56px; width: auto; object-fit: contain; flex-shrink: 0; filter: drop-shadow(0 3px 8px rgba(0,0,0,0.5)); }
  @keyframes feedbackExcited { 0%,100% { transform: translateY(0) rotate(0); } 25% { transform: translateY(-8px) rotate(-5deg); } 75% { transform: translateY(-5px) rotate(5deg); } }
  .feedback-excited { animation: feedbackExcited 0.5s ease-in-out infinite; }
  .attack-btn { width: 100%; font-family: 'Fredoka One', cursive; font-size: 18px; letter-spacing: 2px; text-transform: uppercase; border-radius: 16px; padding: 14px 20px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: transform 0.1s, box-shadow 0.1s; border: none; outline: none; }
  .attack-btn:active { transform: translateY(3px) !important; }
  .attack-btn.ready { background: linear-gradient(180deg,#b24dff 0%,#7b00dd 100%); box-shadow: 0 6px 0 #4a0099, 0 0 20px rgba(155,89,182,0.4), inset 0 1px 0 rgba(255,255,255,0.25); color: #fff; }
  .attack-btn.ready:hover { transform: translateY(-2px); box-shadow: 0 8px 0 #4a0099, 0 0 30px rgba(155,89,182,0.6), inset 0 1px 0 rgba(255,255,255,0.25); }
  .attack-btn.disabled { background: rgba(255,255,255,0.06); box-shadow: none; color: rgba(255,255,255,0.25); cursor: not-allowed; }
  .outcome-overlay { position: absolute; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 16px; animation: overlayFadeIn 0.4s ease-out; padding: 20px; }
  @keyframes overlayFadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
  .defeat-overlay { background: radial-gradient(ellipse at center,rgba(80,10,10,0.95) 0%,rgba(10,0,5,0.98) 100%); }
  .outcome-title { font-family: 'Fredoka One', cursive; font-size: 42px; text-align: center; letter-spacing: 3px; animation: outcomePulse 0.9s ease-in-out infinite; }
  @keyframes outcomePulse { 0%,100% { transform: scale(1) rotate(-1deg); } 50% { transform: scale(1.05) rotate(1deg); } }
  .defeat-title { color: #ff4757; text-shadow: 3px 3px 0 #5c0000; }
  .outcome-subtitle { font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 14px; color: rgba(255,255,255,0.85); text-align: center; max-width: 340px; line-height: 1.6; }
  .outcome-suri { height: 120px; width: auto; object-fit: contain; filter: drop-shadow(0 8px 20px rgba(0,0,0,0.6)); animation: outcomePulse 1.2s ease-in-out infinite; }
  .outcome-btn { background: linear-gradient(180deg,#f9d71c 0%,#e8a21a 100%); border: 4px solid #5c3a1e; border-radius: 18px; padding: 14px 36px; font-family: 'Fredoka One', cursive; font-size: 18px; color: #5c3a1e; cursor: pointer; box-shadow: 0 6px 0 #9a5c08; letter-spacing: 2px; text-transform: uppercase; transition: transform 0.1s, box-shadow 0.1s; }
  .outcome-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 0 #9a5c08; }
  .outcome-btn:active { transform: translateY(3px); box-shadow: 0 3px 0 #9a5c08; }
  @keyframes spinGlow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  .spin-loader { animation: spinGlow 1s linear infinite; display: inline-block; }
  .intro-screen { position: relative; z-index: 10; min-height: calc(100vh - 60px); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 24px 40px; gap: 20px; }
  .intro-subtitle { font-family: 'Nunito', sans-serif; font-weight: 700; font-size: 14px; color: rgba(255,255,255,0.75); text-align: center; max-width: 480px; line-height: 1.7; }
  @keyframes titlePulse { 0%,100% { transform: scale(1) rotate(-1deg); text-shadow: 3px 3px 0 #5c3a1e, 0 0 30px rgba(249,199,31,0.5); } 50% { transform: scale(1.04) rotate(1deg); text-shadow: 3px 3px 0 #5c3a1e, 0 0 60px rgba(249,199,31,0.8); } }
  .intro-title { font-family: 'Fredoka One', cursive; font-size: clamp(32px,6vw,52px); color: #f9c31f; text-shadow: 3px 3px 0 #5c3a1e, 0 0 30px rgba(249,199,31,0.5); animation: titlePulse 2.5s ease-in-out infinite; letter-spacing: 3px; margin: 0; }
  .intro-vs { display: flex; align-items: flex-end; justify-content: center; gap: 20px; width: 100%; max-width: 600px; }
  .intro-char { display: flex; flex-direction: column; align-items: center; gap: 8px; flex: 1; }
  .intro-suri-img { height: clamp(110px,20vw,180px); width: auto; object-fit: contain; filter: drop-shadow(0 8px 20px rgba(61,191,110,0.5)); animation: suriIdle 2.8s ease-in-out infinite; }
  .intro-enemy-img { width: clamp(110px,20vw,180px); height: clamp(110px,20vw,180px); object-fit: cover; border-radius: 50%; border: 4px solid #6c3483; box-shadow: 0 0 30px rgba(108,52,131,0.7); animation: enemyIdle 2.5s ease-in-out infinite; }
  .intro-vs-badge { font-family: 'Fredoka One', cursive; font-size: clamp(28px,5vw,40px); color: #f9c31f; text-shadow: 2px 2px 0 #5c3a1e; padding-bottom: 20px; flex-shrink: 0; }
  .intro-info-row { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
  .info-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(155,89,182,0.3); border-radius: 14px; padding: 10px 18px; text-align: center; min-width: 90px; backdrop-filter: blur(8px); }
  .info-card-icon { font-size: 20px; } .info-card-value { font-family: 'Fredoka One', cursive; color: #f9c31f; font-size: 15px; } .info-card-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.4); }
  .intro-start-btn { width: 100%; max-width: 480px; background: linear-gradient(180deg,#b24dff 0%,#7b00dd 100%); border: 4px solid rgba(155,89,182,0.8); border-radius: 20px; padding: 18px 20px; font-family: 'Fredoka One', cursive; font-size: 22px; color: #fff; cursor: pointer; box-shadow: 0 6px 0 #4a0099, 0 0 30px rgba(155,89,182,0.4); letter-spacing: 2px; text-transform: uppercase; display: flex; align-items: center; justify-content: center; gap: 10px; transition: transform 0.1s, box-shadow 0.1s; }
  .intro-start-btn:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 9px 0 #4a0099, 0 0 50px rgba(155,89,182,0.6); }
  .intro-start-btn:active { transform: translateY(3px); box-shadow: 0 3px 0 #4a0099; }
  .intro-start-btn:disabled { opacity: 0.65; cursor: not-allowed; }
  .intro-skip-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 10px 20px; font-size: 13px; font-weight: 800; color: rgba(255,255,255,0.45); cursor: pointer; letter-spacing: 1px; text-transform: uppercase; transition: color 0.2s, border-color 0.2s; width: 100%; max-width: 480px; }
  .intro-skip-btn:hover:not(:disabled) { color: rgba(255,255,255,0.7); border-color: rgba(255,255,255,0.2); }
  .intro-skip-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .speech-bubble { background: rgba(10,0,20,0.9); border: 1px solid rgba(155,89,182,0.4); border-radius: 12px; padding: 8px 14px; font-size: 12px; font-weight: 700; color: rgba(220,200,255,0.9); font-style: italic; text-align: center; max-width: 340px; }
  .error-banner { margin: 0 20px 12px; background: linear-gradient(135deg,rgba(231,76,60,0.2),rgba(192,57,43,0.25)); border: 1px solid rgba(231,76,60,0.5); border-radius: 14px; padding: 12px 18px; display: flex; align-items: center; gap: 10px; z-index: 10; position: relative; }
  .error-banner span { font-size: 12px; font-weight: 700; color: rgba(255,180,170,0.9); }
  .loading-quest { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px; }
  .loading-text { font-family: 'Fredoka One', cursive; font-size: 14px; color: #c39bd3; letter-spacing: 2px; text-transform: uppercase; }
  ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); } ::-webkit-scrollbar-thumb { background: rgba(155,89,182,0.5); border-radius: 3px; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }
`;

const MAX_HEARTS = 3;
const LABELS = ["A", "B", "C", "D"];
const EMBERS = [
  { left: "12%", bottom: "32%", w: 4, h: 4, dur: 2.8, delay: 0.0, ex: "-12px", ex2: "8px" },
  { left: "28%", bottom: "34%", w: 3, h: 3, dur: 3.5, delay: 0.4, ex: "8px",   ex2: "-5px" },
  { left: "45%", bottom: "33%", w: 5, h: 5, dur: 2.2, delay: 0.8, ex: "15px",  ex2: "-10px" },
  { left: "63%", bottom: "35%", w: 3, h: 3, dur: 3.0, delay: 1.2, ex: "-10px", ex2: "5px" },
  { left: "80%", bottom: "32%", w: 4, h: 4, dur: 2.6, delay: 1.6, ex: "6px",   ex2: "-8px" },
  { left: "91%", bottom: "34%", w: 5, h: 5, dur: 3.8, delay: 2.0, ex: "-8px",  ex2: "10px" },
  { left:  "5%", bottom: "34%", w: 3, h: 3, dur: 2.4, delay: 2.4, ex: "12px",  ex2: "-6px" },
];
const FIREFLIES = [
  { left: "8%",  top: "25%", w: 7,  h: 7,  dur: 7.5, delay: 0.0, ftx: "-25px", fty: "-100px" },
  { left: "20%", top: "40%", w: 9,  h: 9,  dur: 10,  delay: 1.5, ftx:  "30px", fty: "-150px" },
  { left: "55%", top: "20%", w: 6,  h: 6,  dur: 5.5, delay: 0.8, ftx: "-15px", fty:  "-90px" },
  { left: "72%", top: "35%", w: 11, h: 11, dur: 9.0, delay: 2.2, ftx:  "40px", fty: "-130px" },
  { left: "88%", top: "28%", w: 8,  h: 8,  dur: 6.5, delay: 0.4, ftx: "-20px", fty:  "-80px" },
  { left: "38%", top: "50%", w: 7,  h: 7,  dur: 8.5, delay: 3.0, ftx:  "20px", fty: "-110px" },
];
const FOG_WISPS = [
  { left:   "0%", bottom: "31%", w: 280, h: 80, dur: 18, delay:  0, color: "rgba(100,0,180,0.15)" },
  { left:  "30%", bottom: "32%", w: 320, h: 60, dur: 22, delay:  5, color: "rgba(150,0,80,0.1)" },
  { left:  "60%", bottom: "30%", w: 260, h: 70, dur: 15, delay: 10, color: "rgba(80,0,150,0.12)" },
  { left: "-10%", bottom: "33%", w: 350, h: 90, dur: 25, delay:  3, color: "rgba(60,0,120,0.1)" },
];
const PILLARS = [
  { left: "4%",   height: "55vh" },
  { left: "12%",  height: "42vh" },
  { right: "4%",  height: "55vh" },
  { right: "12%", height: "42vh" },
];
const SKULLS = [
  { left:  "3%",  bottom: "58%", delay: 0   },
  { right: "3%",  bottom: "58%", delay: 1.5 },
  { left:  "16%", bottom: "52%", delay: 3   },
  { right: "16%", bottom: "52%", delay: 2   },
];
const SKULL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="28" height="28"><path d="M12 2C6.48 2 2 6.48 2 12c0 3.86 2.17 7.22 5.35 8.96V22h9v-1.04C19.83 19.22 22 15.86 22 12c0-5.52-4.48-10-10-10zm-2 14H8v-2h2v2zm0-4H8v-2h2v2zm4 4h-2v-2h2v2zm0-4h-2v-2h2v2z"/></svg>`;

function ArenaBackground() {
  return (
    <div className="arena-bg" aria-hidden="true">
      <div className="arena-sky" />
      {PILLARS.map((p, i) => <div key={i} className="pillar" style={p as React.CSSProperties} />)}
      {SKULLS.map((s, i) => (
        <div key={i} className="skull-deco"
          style={{ left: (s as { left?: string }).left, right: (s as { right?: string }).right, bottom: s.bottom, animationDelay: `${s.delay}s`, position: "absolute" } as React.CSSProperties}
          dangerouslySetInnerHTML={{ __html: SKULL_SVG }} />
      ))}
      {FOG_WISPS.map((f, i) => (
        <div key={i} className="fog-wisp" style={{ left: f.left, bottom: f.bottom, width: f.w, height: f.h, background: f.color, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s` }} />
      ))}
      <div className="arena-floor" />
      <div className="arena-floor-line" />
      {EMBERS.map((e, i) => (
        <div key={i} className="ember" style={{ left: e.left, bottom: e.bottom, width: e.w, height: e.h, animationDuration: `${e.dur}s`, animationDelay: `${e.delay}s`, ["--ex" as string]: e.ex, ["--ex2" as string]: e.ex2 }} />
      ))}
      {FIREFLIES.map((f, i) => (
        <div key={i} className="firefly" style={{ left: f.left, top: f.top, width: f.w, height: f.h, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s`, ["--ftx" as string]: f.ftx, ["--fty" as string]: f.fty }} />
      ))}
    </div>
  );
}

function HeartIcon({ full, breaking }: { full: boolean; breaking?: boolean }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24"
      className={`heart-icon${breaking ? " heart-breaking" : full ? "" : " empty"}`}
      fill={full || breaking ? "#ff2244" : "#3a1a2a"}
      aria-label={full ? "Full heart" : "Empty heart"}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

type SuriState      = "idle" | "attack" | "hit" | "happy" | "sad" | "defeated";
type EnemyAnimState = "idle" | "attack" | "hit" | "defeated" | "appear";

function suriImg(s: SuriState): string {
  if (s === "happy") return "/suri-snake-happy.png";
  if (s === "sad" || s === "hit" || s === "defeated") return "/suri-snake-sad.png";
  if (s === "attack") return "/suri-snake-right.png";
  return "/suri-snake-left.png";
}
function suriAlt(s: SuriState): string {
  if (s === "happy")    return "Suri celebrating";
  if (s === "sad")      return "Suri sad";
  if (s === "hit")      return "Suri recoiling";
  if (s === "defeated") return "Suri defeated";
  if (s === "attack")   return "Suri attacking";
  return "Suri in battle stance";
}
function suriCls(s: SuriState): string {
  if (s === "attack")   return "suri-sprite suri-attacking";
  if (s === "hit")      return "suri-sprite suri-hit";
  if (s === "defeated") return "suri-sprite suri-defeated-anim";
  return "suri-sprite suri-idle";
}
function enemyCls(s: EnemyAnimState): string {
  if (s === "hit")      return "enemy-sprite enemy-hit";
  if (s === "defeated") return "enemy-sprite enemy-defeated-anim";
  if (s === "appear")   return "enemy-sprite enemy-appear";
  if (s === "attack")   return "enemy-sprite enemy-attacking";
  return "enemy-sprite enemy-idle";
}

export default function DiagnosticPage() {
  const router    = useRouter();
  const params    = useParams();
  const sessionId = params.session_id as string;

  const [phase, setPhase]             = useState<"intro" | "battle" | "defeat">("intro");
  const [probe, setProbe]             = useState<DiagnosticProbe | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [loading, setLoading]         = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [skipping, setSkipping]       = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [feedback, setFeedback]       = useState<{ correct: boolean; nextAction: string } | null>(null);
  const [tileKey, setTileKey]         = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answeredCount, setAnsweredCount]   = useState(0);
  const [score, setScore]   = useState(0);
  const [streak, setStreak] = useState(0);
  const [suriState, setSuriState]       = useState<SuriState>("idle");
  const [suriHearts, setSuriHearts]     = useState(MAX_HEARTS);
  const [suriBreaking, setSuriBreaking] = useState<number | null>(null);
  const [enemyAnimState, setEnemyAnimState] = useState<EnemyAnimState>("idle");
  const [enemyHearts, setEnemyHearts]       = useState(MAX_HEARTS);
  const [enemyBreaking, setEnemyBreaking]   = useState<number | null>(null);
  const [enemyDmg, setEnemyDmg] = useState<string | null>(null);
  const [suriDmg, setSuriDmg]   = useState<string | null>(null);
  const [shaking, setShaking]   = useState(false);
  const [locked, setLocked]     = useState(false);
  const pendingNext = useRef<string | null>(null);

  useEffect(() => {
    sessionStorage.removeItem("diagnostic_answers");
    sessionStorage.removeItem("diagnostic_submit_result");
    (async () => {
      try {
        const s = await getSession(sessionId);
        const { chain } = await getTopicChain(s.topic_entry_node);
        setTotalQuestions(chain.length);
      } catch (e) { console.error(e); }
    })();
  }, [sessionId]);

  const finalize = useCallback(async () => {
    const s = await getSession(sessionId);
    const { chain } = await getTopicChain(s.topic_entry_node);
    const raw = JSON.parse(sessionStorage.getItem("diagnostic_answers") || "{}") as Record<string, boolean>;
    const answers = chain.map(node_id => ({ node_id, correct: !!raw[node_id] }));
    const res = await submitDiagnostic(sessionId, { answers });
    sessionStorage.setItem("diagnostic_submit_result", JSON.stringify(res));
    if (res.gap_node)         sessionStorage.setItem("identified_node_id", res.gap_node);
    if (res.mastered_nodes)   sessionStorage.setItem("diagnostic_mastered",   JSON.stringify(res.mastered_nodes));
    if (res.unresolved_nodes) sessionStorage.setItem("diagnostic_unresolved", JSON.stringify(res.unresolved_nodes));
    router.push(res.redirect);
  }, [sessionId, router]);

  const fetchProbe = useCallback(async () => {
    setLoading(true); setSelectedIdx(null); setFeedback(null);
    setError(null); setLocked(false);
    setSuriState("idle"); setEnemyAnimState("idle");
    try {
      const data = await getDiagnosticProbe(sessionId);
      setProbe(data); setPhase("battle"); setTileKey(k => k + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load question.");
    } finally { setLoading(false); }
  }, [sessionId]);

  const advance = useCallback(async (nextAction: string) => {
    try {
      if (nextAction === "next_probe") await fetchProbe();
      else if (nextAction === "complete") await finalize();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to advance.");
    }
  }, [fetchProbe, finalize]);

  const triggerEnemyHit = useCallback((nextAction: string) => {
    setSuriState("attack");
    setEnemyDmg("💥 -1"); setTimeout(() => setEnemyDmg(null), 900);
    setShaking(true);     setTimeout(() => setShaking(false), 500);
    setEnemyAnimState("hit");
    setTimeout(() => {
      setEnemyHearts(prev => {
        const next = prev - 1;
        setEnemyBreaking(next);
        if (next <= 0) {
          setTimeout(() => {
            setEnemyAnimState("defeated");
            confetti({ particleCount: 180, spread: 110, origin: { y: 0.4 }, colors: ["#f9d71c","#e8a21a","#ff4757","#2ed573","#5352ed","#c39bd3"] });
            setTimeout(() => {
              setEnemyBreaking(null); setEnemyHearts(MAX_HEARTS);
              setEnemyAnimState("appear"); setSuriState("happy");
              setTimeout(async () => {
                setSuriState("idle"); setEnemyAnimState("idle"); setLocked(false);
                await advance(nextAction);
              }, 900);
            }, 1400);
          }, 300);
          return 0;
        } else {
          setTimeout(() => {
            setEnemyBreaking(null); setEnemyAnimState("idle");
            setSuriState("happy"); setTimeout(() => setSuriState("idle"), 800);
            setLocked(false);
            const na = pendingNext.current; pendingNext.current = null;
            if (na) advance(na);
          }, 700);
          return next;
        }
      });
    }, 150);
  }, [advance]);

  const triggerSuriHit = useCallback((nextAction: string) => {
    setEnemyAnimState("attack");
    setSuriDmg("💔 -1"); setTimeout(() => setSuriDmg(null), 900);
    setShaking(true);     setTimeout(() => setShaking(false), 500);
    setTimeout(() => {
      setSuriState("hit");
      setSuriHearts(prev => {
        const next = prev - 1;
        setSuriBreaking(next);
        if (next <= 0) {
          setTimeout(() => {
            setSuriState("defeated"); setSuriBreaking(null);
            setPhase("defeat"); setEnemyAnimState("idle");
          }, 700);
          return 0;
        } else {
          setTimeout(() => {
            setSuriBreaking(null); setSuriState("sad"); setEnemyAnimState("idle");
            setTimeout(() => setSuriState("idle"), 800);
            setLocked(false);
            const na = pendingNext.current; pendingNext.current = null;
            if (na) advance(na);
          }, 700);
          return next;
        }
      });
    }, 200);
  }, [advance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIdx === null || !probe || submitting || locked) return;
    setSubmitting(true); setLocked(true); setError(null);
    try {
      const res = await submitDiagnosticAnswer(sessionId, { node_id: probe.node_id, selected_option_index: selectedIdx });
      setFeedback({ correct: res.correct, nextAction: res.next_action });
      const cur = JSON.parse(sessionStorage.getItem("diagnostic_answers") || "{}");
      cur[probe.node_id] = res.correct;
      sessionStorage.setItem("diagnostic_answers", JSON.stringify(cur));
      setAnsweredCount(Object.keys(cur).length);
      if (res.correct) {
        setScore(s => s + (10 + streak * 5)); setStreak(s => s + 1);
        toast.success("⚔️ Direct hit!");
        pendingNext.current = res.next_action;
        triggerEnemyHit(res.next_action);
      } else {
        setStreak(0);
        toast.error("⚠️ The enemy counters!");
        pendingNext.current = res.next_action;
        triggerSuriHit(res.next_action);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit answer.");
      setLocked(false);
    } finally { setSubmitting(false); }
  };

  const handleSkip = async () => {
    setSkipping(true); setError(null);
    try { const res = await skipDiagnostic(sessionId); router.push(res.redirect); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to skip."); setSkipping(false); }
  };

  const retryAfterDefeat = () => {
    setSuriHearts(MAX_HEARTS); setSuriBreaking(null); setSuriState("idle");
    setEnemyAnimState("idle"); setPhase("battle");
    setFeedback(null); setLocked(false); setSelectedIdx(null);
  };

  const continueAfterDefeat = async () => {
    setSuriHearts(MAX_HEARTS); setSuriState("idle"); setEnemyAnimState("idle");
    setPhase("battle"); setFeedback(null); setLocked(false); setSelectedIdx(null);
    const na = pendingNext.current; pendingNext.current = null;
    try { if (na === "complete") await finalize(); else await fetchProbe(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to continue."); }
  };

  const pct = totalQuestions > 0 ? Math.min((answeredCount / totalQuestions) * 100, 100) : 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GAME_CSS }} />
      <div className={`battle-body${shaking ? " screen-shake" : ""}`}>
        <ArenaBackground />
        <header className="hud-bar" role="banner">
          <div className="hud-brand">
            <span className="hud-logo">⚔️ SURI</span>
            <span className="hud-tag">{phase === "intro" ? "Placement Quest" : "Battle Diagnostic"}</span>
          </div>
          {phase !== "intro" && (
            <div className="hud-center">
              <span className="hud-progress-text">{answeredCount}/{totalQuestions || "?"}</span>
              <div className="hud-progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Quest progress">
                <div className="hud-progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          <div className="hud-right">
            {streak > 1 && <div className="streak-pill" aria-label={`${streak} answer streak`}>🔥 {streak}×</div>}
            <div className="score-chip" aria-label={`Score: ${score}`}>⭐ {score}</div>
          </div>
        </header>

        {phase === "intro" && (
          <main className="intro-screen" id="intro-screen">
            <h1 className="intro-title">⚔️ BATTLE QUEST</h1>
            <p className="intro-subtitle">
              Prove your knowledge in the arena! Answer correctly to strike the enemy —
              every wrong answer lets them hit back. Survive with 3 hearts!
            </p>
            <div className="intro-vs" aria-label="Suri vs Math Villain">
              <div className="intro-char">
                <img src="/suri-snake-left.png" alt="Suri the snake" className="intro-suri-img" />
                <span className="char-name" style={{ color: "#3dbf6e" }}>Suri</span>
              </div>
              <span className="intro-vs-badge" aria-hidden="true">VS</span>
              <div className="intro-char">
                <img src="/enemy-math-villain.jpg" alt="The Math Villain" className="intro-enemy-img" />
                <span className="char-name" style={{ color: "#c39bd3" }}>Math Villain</span>
              </div>
            </div>
            <div className="speech-bubble">
              &ldquo;Ready to test your skills? Let&apos;s see what you&apos;ve got!&rdquo;
            </div>
            <div className="intro-info-row">
              <div className="info-card"><div className="info-card-icon">❤️</div><div className="info-card-value">3 Hearts</div><div className="info-card-label">Per Fighter</div></div>
              <div className="info-card"><div className="info-card-icon">⚡</div><div className="info-card-value">Streak Bonus</div><div className="info-card-label">Score Multiplier</div></div>
              <div className="info-card"><div className="info-card-icon">🎯</div><div className="info-card-value">Adaptive</div><div className="info-card-label">Questions</div></div>
            </div>
            <button id="start-battle-btn" className="intro-start-btn" onClick={fetchProbe} disabled={loading} aria-busy={loading}>
              {loading ? <><span className="spin-loader">⚙️</span> Loading…</> : "⚔️ START BATTLE"}
            </button>
            <button id="skip-diagnostic-btn" className="intro-skip-btn" onClick={handleSkip} disabled={skipping || loading}>
              {skipping ? "Skipping…" : "Skip Diagnostic →"}
            </button>
            {error && <div className="error-banner" role="alert"><span>⚠️ {error}</span></div>}
          </main>
        )}

        {(phase === "battle" || phase === "defeat") && (
          <div className="battle-layout">
            <div className="arena-section" aria-label="Battle arena">
              <div className="char-container suri-side">
                <div className="name-plate">
                  <span className="char-name" style={{ color: "#3dbf6e" }}>🐍 Suri</span>
                  <span className="char-title" style={{ color: "#3dbf6e" }}>Your Champion</span>
                </div>
                <div className="hearts-bar" aria-label={`Suri hearts: ${suriHearts} of ${MAX_HEARTS}`}>
                  {Array.from({ length: MAX_HEARTS }, (_, i) => { const hi = MAX_HEARTS - 1 - i; return <HeartIcon key={hi} full={hi < suriHearts} breaking={suriBreaking === hi} />; })}
                </div>
                <div className="sprite-frame">
                  {suriDmg && <div className="dmg-number dmg-suri" aria-live="assertive">{suriDmg}</div>}
                  <img src={suriImg(suriState)} alt={suriAlt(suriState)} className={suriCls(suriState)} draggable={false} />
                </div>
              </div>
              <div className="vs-divider" aria-hidden="true"><div className="vs-badge">VS</div></div>
              <div className="char-container enemy-side">
                <div className="name-plate" style={{ alignItems: "flex-end" }}>
                  <span className="char-name" style={{ color: "#c39bd3" }}>Math Villain 🧙</span>
                  <span className="char-title" style={{ color: "#c39bd3" }}>The Enemy</span>
                </div>
                <div className="hearts-bar" aria-label={`Enemy hearts: ${enemyHearts} of ${MAX_HEARTS}`}>
                  {Array.from({ length: MAX_HEARTS }, (_, i) => { const hi = MAX_HEARTS - 1 - i; return <HeartIcon key={hi} full={hi < enemyHearts} breaking={enemyBreaking === hi} />; })}
                </div>
                <div className="sprite-frame">
                  {enemyDmg && <div className="dmg-number dmg-enemy" aria-live="assertive">{enemyDmg}</div>}
                  <img src="/enemy-math-villain.jpg" alt="The Math Villain" className={enemyCls(enemyAnimState)} draggable={false} />
                </div>
              </div>
              {phase === "defeat" && (
                <div className="outcome-overlay defeat-overlay" role="dialog" aria-label="Defeat screen">
                  <img src="/suri-snake-sad.png" alt="Suri defeated" className="outcome-suri" />
                  <h2 className="outcome-title defeat-title">DEFEATED!</h2>
                  <p className="outcome-subtitle">The Math Villain overpowered Suri! But every warrior learns from defeat…</p>
                  <button id="retry-btn" className="outcome-btn" onClick={retryAfterDefeat}>🔁 TRY AGAIN</button>
                  <button id="continue-btn" className="outcome-btn" style={{ background: "linear-gradient(180deg,#3dbf6e,#1a8a45)", borderColor: "#0f5430", color: "#fff", boxShadow: "0 6px 0 #0f5430" }} onClick={continueAfterDefeat}>▶ CONTINUE →</button>
                </div>
              )}
            </div>
            {phase === "battle" && (
              <section className="battle-panel" aria-label="Question panel">
                {error && <div className="error-banner" role="alert"><span>⚠️ {error}</span></div>}
                {loading ? (
                  <div className="loading-quest question-scroll">
                    <span className="spin-loader" style={{ fontSize: 36 }}>⚙️</span>
                    <p className="loading-text">Loading challenge…</p>
                  </div>
                ) : probe ? (
                  <form onSubmit={handleSubmit} noValidate>
                    <div className="question-scroll" role="region" aria-label="Current question">
                      <div className="question-badge">📜 Choose your spell</div>
                      <p className="question-text" id="question-text">{probe.question_text}</p>
                    </div>
                    <div className="spell-grid" role="radiogroup" aria-labelledby="question-text" key={tileKey}>
                      {probe.options.map((opt, idx) => {
                        const isSelected = selectedIdx === idx;
                        const isCorrect  = feedback !== null && isSelected && feedback.correct;
                        const isWrong    = feedback !== null && isSelected && !feedback.correct;
                        let cls = "spell-tile spell-tile-enter";
                        if (isSelected) cls += " selected";
                        if (locked)     cls += " locked";
                        if (isCorrect && feedback) cls += " correct-reveal";
                        if (isWrong)    cls += " wrong-reveal";
                        return (
                          <button key={idx} type="button" role="radio" aria-checked={isSelected} id={`spell-option-${idx}`} className={cls}
                            onClick={() => { if (!locked && !feedback) setSelectedIdx(idx); }} disabled={!!feedback || locked}>
                            <div className="spell-label">{LABELS[idx]}</div>
                            <div className="spell-text">{opt}</div>
                            {isSelected && !feedback && <div className="spell-check">✓</div>}
                            {isCorrect && feedback && <div className="spell-check" style={{ background: "#3dbf6e" }}>✓</div>}
                            {isWrong && <div className="spell-check" style={{ background: "#e74c3c" }}>✗</div>}
                          </button>
                        );
                      })}
                    </div>
                    {feedback && (
                      <div className={`feedback-banner ${feedback.correct ? "correct" : "wrong"}`} role="status">
                        <img src={feedback.correct ? "/suri-snake-happy.png" : "/suri-snake-sad.png"} alt={feedback.correct ? "Suri happy" : "Suri sad"} className={`feedback-suri${feedback.correct ? " feedback-excited" : ""}`} />
                        <div>
                          <p className="feedback-title">{feedback.correct ? "⚔️ Direct Hit!" : "💔 Enemy Strikes!"}</p>
                          <p className="feedback-quote">{feedback.correct ? "Excellent spell! The villain recoils in pain!" : "That spell wasn't effective!"}</p>
                        </div>
                      </div>
                    )}
                    {!feedback && (
                      <button id="cast-spell-btn" type="submit" className={`attack-btn ${selectedIdx !== null && !locked ? "ready" : "disabled"}`} disabled={selectedIdx === null || locked || submitting} aria-disabled={selectedIdx === null || locked || submitting}>
                        {submitting ? <><span className="spin-loader">⚙️</span> Casting…</> : selectedIdx !== null ? "⚡ CAST SPELL!" : "← Choose a Spell First"}
                      </button>
                    )}
                  </form>
                ) : null}
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}