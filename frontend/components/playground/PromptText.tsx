"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/** Renders Markdown with $inline$ / $$block$$ LaTeX, the format used by Playground prompts and steps. */
export default function PromptText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
