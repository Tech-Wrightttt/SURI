"use client";

import "mathlive";
import React, { useEffect, useRef } from "react";

export type MathFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onEnter?: () => void;
  autoFocus?: boolean;
};

type MathFieldElement = HTMLElement & {
  value: string;
  focus: () => void;
};

export default function MathField({ value, onChange, disabled = false, onEnter, autoFocus = true }: MathFieldProps) {
  const mathFieldRef = useRef<MathFieldElement | null>(null);

  useEffect(() => {
    if (mathFieldRef.current && mathFieldRef.current.value !== value) {
      mathFieldRef.current.value = value;
    }
  }, [value]);

  useEffect(() => {
    const mf = mathFieldRef.current;
    if (!mf) return;

    const handleInput = () => {
      onChange(mf.value);
    };

    mf.addEventListener("input", handleInput);
    return () => {
      mf.removeEventListener("input", handleInput);
    };
  }, [onChange]);

  useEffect(() => {
    const mf = mathFieldRef.current;
    if (!mf || !onEnter) return;

    const handleKeydown = (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === "Enter") {
        ke.preventDefault();
        onEnter();
      }
    };

    mf.addEventListener("keydown", handleKeydown);
    return () => {
      mf.removeEventListener("keydown", handleKeydown);
    };
  }, [onEnter]);

  useEffect(() => {
    if (!disabled && autoFocus) {
      const timer = setTimeout(() => {
        mathFieldRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [disabled, autoFocus]);

  return React.createElement("math-field", {
    ref: mathFieldRef,
    disabled,
    "virtual-keyboard-mode": "onfocus",
    style: {
      width: "100%",
      minWidth: "220px",
      minHeight: "56px",
      padding: "12px 18px",
      border: "3px solid #f5b025",
      borderRadius: "10px",
      background: "linear-gradient(180deg, #fffdf2, #fbeec8)",
      fontSize: "1.15rem",
      fontWeight: "bold",
      boxShadow: "0 0 14px rgba(245, 176, 37, 0.45), 0 4px 0 #28150c, inset 0 0 0 2px rgba(255,255,255,0.4)",
      outline: "none",
      color: "#28150c",
      cursor: "text",
    },
  });
}
