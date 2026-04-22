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

// Etiquetas visibles en la UI. El tipo interno sigue siendo "LIB" | "SHOP"
// para no romper a los consumidores, pero al usuario le mostramos textos
// descriptivos.
const tokenLabels: Record<TokenType, string> = {
  LIB: "Préstamos",
  SHOP: "ShopTokens",
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
      <span className="opacity-70">{tokenLabels[token]}</span>
    </span>
  );
}
