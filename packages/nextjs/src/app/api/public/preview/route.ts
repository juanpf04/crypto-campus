import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { groupProducts } from "@/lib/shop-utils";

/** El límite de 6 grupos se aplica en el cliente tras filtrar por categoría. */

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
        include: {
          base: {
            select: { slug: true, name: true, description: true, category: true },
          },
        },
        orderBy: [
          { category: "asc" },
          { baseId: "asc" },
          { sortOrder: "asc" },
          { name: "asc" },
        ],
      }),
    ]);

    const categories = categoriesRaw
      .map((entry) => entry.category)
      .filter((category): category is string => !!category);

    const grouped = groupProducts(productsRaw);

    return NextResponse.json({
      printingTokensPreview: 200,
      availableRooms,
      availableBooks,
      shop: {
        categories,
        products: grouped,
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
