/**
 * shop-utils.ts — Helpers de agrupación de productos compartidos.
 *
 * Usados por actions/shop.ts y api/public/preview.
 */

export type ProductVariantSummary = {
	id: string;
	productId: number;
	name: string;
	price: number;
	stock: number;
	category: string | null;
	imageUrl: string | null;
	color: string;
	variantLabel: string | null;
};

export type ProductGroupSummary = {
	groupKey: string;
	name: string;
	description: string | null;
	category: string | null;
	price: number;
	minPrice: number;
	maxPrice: number;
	totalStock: number;
	defaultVariantId: string;
	variants: ProductVariantSummary[];
};

export function slugify(value: string): string {
	return value
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function normalizeColor(color: string | null | undefined): string {
	return (color ?? "default").trim().toLowerCase() || "default";
}

function toDisplayColor(raw: string): string {
	const normalized = normalizeColor(raw);
	return normalized
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

export function deriveBaseKeyFromImageUrl(imageUrl: string | null): string | null {
	if (!imageUrl) return null;
	const parts = imageUrl.split("/").filter(Boolean);
	if (parts.length < 4) return null;
	const baseParts = parts.slice(1, -2);
	if (baseParts.length === 0) return null;
	return slugify(baseParts.join("-"));
}

export function deriveBaseName(name: string, color: string): string {
	const displayColor = toDisplayColor(color);
	const variants = [displayColor, displayColor.toLowerCase(), displayColor.toUpperCase()];

	for (const candidate of variants) {
		const suffix = ` ${candidate}`;
		if (name.endsWith(suffix)) {
			return name.slice(0, -suffix.length).trim();
		}
	}

	return name;
}

export function deriveColorFromImageUrl(imageUrl: string | null): string {
	if (!imageUrl) return "default";
	const parts = imageUrl.split("/").filter(Boolean);
	if (parts.length < 2) return "default";
	const candidate = parts[parts.length - 2];
	return normalizeColor(candidate);
}

/** Agrupar productos planos en grupos por base. */
export function groupProducts(
	products: Array<{
		id: string;
		productId: number;
		name: string;
		price: number;
		stock: number;
		category: string | null;
		imageUrl: string | null;
		color: string | null;
		variantLabel: string | null;
		description: string | null;
		base?: { slug: string; name: string; description: string | null; category: string | null } | null;
	}>,
): ProductGroupSummary[] {
	const groups = new Map<string, ProductGroupSummary>();

	for (const product of products) {
		const color = normalizeColor(product.color ?? deriveColorFromImageUrl(product.imageUrl));
		const fallbackBaseKey = deriveBaseKeyFromImageUrl(product.imageUrl) ?? slugify(product.name);
		const baseName = product.base?.name ?? deriveBaseName(product.name, color);
		const baseKey = product.base?.slug ?? fallbackBaseKey;
		const variant: ProductVariantSummary = {
			id: product.id,
			productId: product.productId,
			name: product.name,
			price: product.price,
			stock: product.stock,
			category: product.category,
			imageUrl: product.imageUrl,
			color,
			variantLabel: product.variantLabel,
		};

		if (!groups.has(baseKey)) {
			groups.set(baseKey, {
				groupKey: baseKey,
				name: baseName,
				category: product.base?.category ?? product.category,
				description: product.base?.description ?? product.description,
				price: product.price,
				minPrice: product.price,
				maxPrice: product.price,
				totalStock: Math.max(product.stock, 0),
				defaultVariantId: product.id,
				variants: [variant],
			});
			continue;
		}

		const current = groups.get(baseKey)!;
		current.minPrice = Math.min(current.minPrice, product.price);
		current.maxPrice = Math.max(current.maxPrice, product.price);
		current.totalStock += Math.max(product.stock, 0);
		current.variants.push(variant);
	}

	return [...groups.values()].map((group) => ({
		...group,
		variants: group.variants.sort((a, b) => a.color.localeCompare(b.color)),
	}));
}
