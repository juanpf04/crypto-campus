"use client";

import { cn } from "@/lib/utils";

interface PasswordRequirementsProps {
  password: string;
}

const requirements = [
  { label: "Al menos 8 caracteres", test: (p: string) => p.length >= 8 },
  { label: "Al menos 1 mayúscula", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Al menos 1 minúscula", test: (p: string) => /[a-z]/.test(p) },
  { label: "Al menos 1 número", test: (p: string) => /[0-9]/.test(p) },
  { label: "Al menos 1 carácter especial", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  if (!password) return null;

  return (
    <ul className="flex flex-col gap-1 text-xs">
      {requirements.map((req) => {
        const passes = req.test(password);
        return (
          <li
            key={req.label}
            className={cn(
              "flex items-center gap-1.5 transition-colors",
              passes ? "text-success" : "text-danger",
            )}
          >
            <span className="text-[10px]">{passes ? "✓" : "✗"}</span>
            {req.label}
          </li>
        );
      })}
    </ul>
  );
}
