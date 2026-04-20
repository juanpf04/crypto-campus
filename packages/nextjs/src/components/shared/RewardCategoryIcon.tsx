"use client";

import type { RewardCategory } from "@prisma/client";
import { icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<RewardCategory, keyof typeof icons> = {
	TIEMPO: "pending",
	EXAMEN: "exam",
	PRACTICA: "task",
	CONSULTA: "chat",
	OTROS: "reward",
};

const CATEGORY_LABEL: Record<RewardCategory, string> = {
	TIEMPO: "Tiempo",
	EXAMEN: "Examen",
	PRACTICA: "Práctica",
	CONSULTA: "Consulta",
	OTROS: "Otros",
};

const CATEGORY_COLOR: Record<RewardCategory, string> = {
	TIEMPO: "bg-primary/15 text-primary",
	EXAMEN: "bg-danger/15 text-danger",
	PRACTICA: "bg-success/15 text-success",
	CONSULTA: "bg-secondary/15 text-secondary",
	OTROS: "bg-warning/15 text-warning",
};

interface RewardCategoryIconProps {
	category: RewardCategory;
	size?: "sm" | "md" | "lg";
	withLabel?: boolean;
	className?: string;
}

export function RewardCategoryIcon({
	category,
	size = "md",
	withLabel = false,
	className,
}: RewardCategoryIconProps) {
	const sizeClass =
		size === "sm" ? "h-8 w-8" : size === "lg" ? "h-14 w-14" : "h-10 w-10";

	return (
		<div className={cn("inline-flex items-center gap-2", className)}>
			<div
				className={cn(
					"inline-flex items-center justify-center rounded-xl shrink-0",
					sizeClass,
					CATEGORY_COLOR[category],
				)}
				aria-label={CATEGORY_LABEL[category]}
			>
				{icons[CATEGORY_ICON[category]]}
			</div>
			{withLabel && (
				<span className="text-sm font-medium text-text-muted">
					{CATEGORY_LABEL[category]}
				</span>
			)}
		</div>
	);
}

export function getCategoryLabel(category: RewardCategory): string {
	return CATEGORY_LABEL[category];
}
