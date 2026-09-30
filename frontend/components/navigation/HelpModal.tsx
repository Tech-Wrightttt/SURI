"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Calculator,
  CheckCircle2,
  CircleHelp,
  Compass,
  History,
  ListChecks,
  Map,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";

export type HelpPage = "dashboard" | "topics" | "progress" | "calculator" | "error-history";

type HelpSection = {
  title: string;
  icon: LucideIcon;
  items: string[];
  numbered?: boolean;
};

type HelpContent = {
  label: string;
  eyebrow: string;
  summary: string;
  icon: LucideIcon;
  sections: HelpSection[];
};

const HELP_CONTENT: Record<HelpPage, HelpContent> = {
  dashboard: {
    label: "Dashboard",
    eyebrow: "YOUR LEARNING KINGDOM",
    summary: "The Dashboard is your starting point for checking your learning status and travelling to every major part of SURI.",
    icon: Map,
    sections: [
      {
        title: "What can I do here?",
        icon: Compass,
        items: [
          "Choose a landmark to open Topics, Progress, Calculator, or Error History.",
          "Open SURI Keep to view your student overview, account details, and learning totals.",
          "Return to an active learning session from the area where you started it.",
        ],
      },
      {
        title: "How to use it",
        icon: ListChecks,
        numbered: true,
        items: [
          "Hover or focus a landmark to see what it contains.",
          "Select the landmark to travel to that page.",
          "Use the progress and record counts to decide what to study or review next.",
        ],
      },
    ],
  },
  topics: {
    label: "Topics",
    eyebrow: "CHOOSE A LEARNING TRAIL",
    summary: "Topics organizes the algebra skills you can study and shows how each skill connects to the next part of your learning path.",
    icon: BookOpen,
    sections: [
      {
        title: "What can I do here?",
        icon: Target,
        items: [
          "Choose an available topic to open its learning path.",
          "Check the progress and completion indicators for each topic.",
          "See which earlier skills are prerequisites for later topics.",
        ],
      },
      {
        title: "How to use it",
        icon: ListChecks,
        numbered: true,
        items: [
          "Select a topic card to review its skills and begin or continue learning.",
          "Complete prerequisite topics to make the next connected skills available.",
          "Follow the diagnostic, lesson, practice, and quiz stages shown in your session.",
        ],
      },
    ],
  },
  progress: {
    label: "Progress",
    eyebrow: "READ YOUR LEARNING TRAIL",
    summary: "Progress shows how much of your learning path you have completed and which competencies you have already mastered.",
    icon: TrendingUp,
    sections: [
      {
        title: "What can I see here?",
        icon: CheckCircle2,
        items: [
          "Your overall completion percentage across the available competencies.",
          "Progress grouped by topic or grade-level learning path.",
          "The competencies that are mastered, in progress, or still ahead.",
        ],
      },
      {
        title: "How to read it",
        icon: ListChecks,
        numbered: true,
        items: [
          "Use the overall percentage for a quick view of your completed path.",
          "Compare topic sections to find where you have made progress and what remains.",
          "Treat mastered competencies as completed milestones on your learning trail.",
        ],
      },
    ],
  },
  calculator: {
    label: "Calculator",
    eyebrow: "USE THE ALGEBRA WORKSHOP",
    summary: "The Calculator simplifies supported algebraic expressions and explains each change in a clear, step-by-step path.",
    icon: Calculator,
    sections: [
      {
        title: "What can I do here?",
        icon: Sparkles,
        items: [
          "Enter expressions with variables, powers, roots, fractions, and parentheses.",
          "Use the on-screen math keyboard or choose an example expression.",
          "View the simplified answer and the steps used to reach it.",
        ],
      },
      {
        title: "How to use it",
        icon: ListChecks,
        numbered: true,
        items: [
          "Type or edit an expression in the input field.",
          "Press Enter or select Show steps to solve it.",
          "Select Reset to clear the expression, result, and any message before starting again.",
        ],
      },
    ],
  },
  "error-history": {
    label: "Error History",
    eyebrow: "REVISIT YOUR REVIEW NOTES",
    summary: "Error History keeps the misconceptions recorded during learning so you can return to the exact skills that may need more practice.",
    icon: History,
    sections: [
      {
        title: "What can I see here?",
        icon: CircleHelp,
        items: [
          "Each record names the related competency and the step to revisit.",
          "Suri's recovery note gives a focused reminder for your next attempt.",
          "The archive overview shows how many errors are recorded and how many lessons are active.",
        ],
      },
      {
        title: "How to use it",
        icon: ListChecks,
        numbered: true,
        items: [
          "Read the competency name and What to revisit note on a record.",
          "Use the recorded date to understand when the difficulty occurred.",
          "Select Review lesson to return to an active lesson or open that competency for review.",
        ],
      },
    ],
  },
};

export function getHelpPage(pathname: string): HelpPage | null {
  if (pathname === "/dashboard") return "dashboard";
  if (pathname === "/topics" || pathname.startsWith("/topics/")) return "topics";
  if (pathname === "/progress") return "progress";
  if (pathname === "/calculator") return "calculator";
  if (pathname === "/error-history") return "error-history";
  return null;
}

export default function HelpModal({ page, opener, onClose }: { page: HelpPage; opener: HTMLElement | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const content = HELP_CONTENT[page];
  const PageIcon = content.icon;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
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
    <div className="suri-help-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="suri-help-modal" role="dialog" aria-modal="true" aria-labelledby="suri-help-title" aria-describedby="suri-help-summary" tabIndex={-1}>
        <header className="suri-help-header">
          <div className="suri-help-heading">
            <span className="suri-help-page-icon" aria-hidden="true"><PageIcon size={24} /></span>
            <div>
              <span className="suri-help-eyebrow">{content.eyebrow}</span>
              <h2 id="suri-help-title"><em>{content.label}</em> Help</h2>
            </div>
          </div>
          <button type="button" className="suri-help-close" onClick={onClose} aria-label="Close help"><X size={20} /></button>
        </header>

        <div className="suri-help-scroll">
          <section className="suri-help-overview" aria-labelledby="suri-help-purpose">
            <div className="suri-help-section-heading">
              <h3 id="suri-help-purpose">What is this page?</h3>
            </div>
            <article className="suri-help-purpose-card">
              <span aria-hidden="true"><Compass size={21} /></span>
              <div><b>{content.label} at a glance</b><p id="suri-help-summary">{content.summary}</p></div>
            </article>
          </section>

          <div className="suri-help-guide-grid">
            {content.sections.map((section) => {
              const SectionIcon = section.icon;
              const List = section.numbered ? "ol" : "ul";
              return <section key={section.title} className="suri-help-guide-section">
                <div className="suri-help-section-heading">
                  <h3>{section.title}</h3>
                </div>
                <article className="suri-help-card">
                  <span className="suri-help-card-icon" aria-hidden="true"><SectionIcon size={19} /></span>
                  <List>{section.items.map((item, index) => <li key={item}>{section.numbered && <b aria-hidden="true">{index + 1}</b>}<span>{item}</span></li>)}</List>
                </article>
              </section>;
            })}
          </div>

        </div>
      </div>
    </div>,
    document.body,
  );
}
