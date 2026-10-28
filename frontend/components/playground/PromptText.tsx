"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// A $$...$$ block that sits mid-sentence renders inline and floats beside the text, so give each one its own paragraph.
function isolateDisplayMath(text: string): string {
  return text.replace(/[ \t]*\$\$([\s\S]*?)\$\$[ \t]*/g, (_m, body: string) => `\n\n$$\n${body.trim()}\n$$\n\n`).trim();
}

// Prompts write systems as aligned lines ("y &= 2x - 3"), which aligns on "=" and leaves the shorter line indented.
// Show them as a left-aligned system with a brace instead.
function asSystem(text: string): string {
  return text.replace(/\\begin\{aligned\}([\s\S]*?)\\end\{aligned\}/g, (_m, body: string) =>
    `\\left\\{\\begin{array}{l}${body.replace(/&/g, "")}\\end{array}\\right.`
  );
}

interface Props {
  text: string;
  className?: string;
  /** Left-align aligned blocks as a system with a brace (use for problem prompts, not worked steps). */
  system?: boolean;
}

/** Renders Markdown with $inline$ / $$block$$ LaTeX, the format used by Playground prompts and steps. */
export default function PromptText({ text, className, system = false }: Props) {
  const source = isolateDisplayMath(system ? asSystem(text) : text);
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
