"use client";

import { Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";

interface AddressDisplayProps {
  address: string;
  chars?: number;
  className?: string;
}

function truncate(addr: string, chars: number): string {
  if (addr.length <= chars * 2 + 2) return addr;
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

export function AddressDisplay({ address, chars = 4, className }: AddressDisplayProps) {
  return (
    <Tooltip content={address} copyable>
      <code className={cn("text-xs font-mono text-text-muted", className)}>
        {truncate(address, chars)}
      </code>
    </Tooltip>
  );
}
