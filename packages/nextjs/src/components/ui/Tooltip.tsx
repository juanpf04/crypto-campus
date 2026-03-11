"use client";

import { useState, useCallback, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: string;
  children: ReactNode;
  copyable?: boolean;
  className?: string;
}

export function Tooltip({ content, children, copyable, className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleCopy = useCallback(async () => {
    if (!copyable) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 1500);
  }, [content, copyable]);

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => { setVisible(false); setCopied(false); }}
    >
      <span
        onClick={handleCopy}
        className={copyable ? "cursor-pointer" : undefined}
      >
        {children}
      </span>
      {visible && (
        <span
          role="tooltip"
          className={cn(
            "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50",
            "whitespace-nowrap rounded-md bg-text px-2.5 py-1 text-xs text-card shadow-lg",
            "pointer-events-none animate-in fade-in-0",
          )}
        >
          {copied ? "Copiado!" : content}
        </span>
      )}
    </span>
  );
}
