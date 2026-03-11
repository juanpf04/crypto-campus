"use client";

import { cn } from "@/lib/utils";

type TokenType = "LIB" | "SHOP";

interface TokenBalanceProps {
  amount: number;
  token: TokenType;
  size?: "sm" | "md";
  className?: string;
}

const tokenStyles: Record<TokenType, string> = {
  LIB: "bg-primary/10 text-primary",
  SHOP: "bg-success/10 text-success",
};

export function TokenBalance({ amount, token, size = "md", className }: TokenBalanceProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        tokenStyles[token],
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        className,
      )}
    >
      <span className="font-bold">{amount}</span>
      <span className="opacity-70">{token}</span>
    </span>
  );
}
