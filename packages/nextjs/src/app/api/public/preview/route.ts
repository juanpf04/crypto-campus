import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SHOP_PREVIEW_LIMIT = 6;

export async function GET() {
  try {
    const [availableRooms, availableBooks, categoriesRaw, productsRaw] = await Promise.all([
      prisma.room.count({ where: { active: true } }),
      prisma.libraryItem.count({ where: { active: true, type: "BOOK" } }),
      prisma.product.findMany({
        where: {
          active: true,
          category: { not: null },
        },
        select: { category: true },
        distinct: ["category"],
        orderBy: { category: "asc" },
      }),
      prisma.product.findMany({
        where: {
          active: true,
          stock: { gt: 0 },
        },
        select: {
          id: true,
          name: true,
          category: true,
          imageUrl: true,
          price: true,
          stock: true,
          color: true,
          variantLabel: true,
        },
        orderBy: [
          { sortOrder: "asc" },
          { createdAt: "desc" },
        ],
        take: SHOP_PREVIEW_LIMIT,
      }),
    ]);

    const categories = categoriesRaw
      .map((entry) => entry.category)
      .filter((category): category is string => !!category);

    return NextResponse.json({
      printingTokensPreview: 200,
      availableRooms,
      availableBooks,
      shop: {
        categories,
        products: productsRaw,
      },
    });
  } catch (error) {
    console.error("[GET /api/public/preview]", error);
    return NextResponse.json(
      { error: "Error al cargar la previsualización" },
      { status: 500 },
    );
  }
}
