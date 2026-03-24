/**
 * /api/shop/cart
 * GET    -> Obtener carrito del usuario
 * POST   -> Agregar item al carrito { productId, quantity? }
 * PATCH  -> Actualizar cantidad { itemId, quantity }
 * DELETE -> Eliminar item (?itemId=...) o vaciar carrito (?clear=1)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getMyCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearMyCart,
} from "@/actions/shop";

export async function GET() {
  try {
    const cart = await getMyCart();
    return NextResponse.json(cart);
  } catch (error) {
    console.error("[GET /api/shop/cart]", error);
    const message = error instanceof Error ? error.message : "Error al obtener carrito";
    const status = message === "No autorizado" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { productId, quantity } = await req.json();

    if (!productId) {
      return NextResponse.json({ error: "Campo requerido: productId" }, { status: 400 });
    }

    const cart = await addToCart(productId, quantity ?? 1);
    return NextResponse.json(cart, { status: 201 });
  } catch (error) {
    console.error("[POST /api/shop/cart]", error);
    const message = error instanceof Error ? error.message : "Error al agregar al carrito";
    const status = message === "No autorizado" ? 403
      : message === "Producto no disponible" ? 404
      : message === "Stock insuficiente" ? 409
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { itemId, quantity } = await req.json();

    if (!itemId || quantity === undefined) {
      return NextResponse.json(
        { error: "Campos requeridos: itemId, quantity" },
        { status: 400 },
      );
    }

    const cart = await updateCartItemQuantity(itemId, quantity);
    return NextResponse.json(cart);
  } catch (error) {
    console.error("[PATCH /api/shop/cart]", error);
    const message = error instanceof Error ? error.message : "Error al actualizar item";
    const status = message === "No autorizado" ? 403
      : message === "Item de carrito no encontrado" ? 404
      : message === "Stock insuficiente" ? 409
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const clear = req.nextUrl.searchParams.get("clear") === "1";
    if (clear) {
      const cart = await clearMyCart();
      return NextResponse.json(cart);
    }

    const itemId = req.nextUrl.searchParams.get("itemId");
    if (!itemId) {
      return NextResponse.json(
        { error: "Debes indicar itemId o clear=1" },
        { status: 400 },
      );
    }

    const cart = await removeCartItem(itemId);
    return NextResponse.json(cart);
  } catch (error) {
    console.error("[DELETE /api/shop/cart]", error);
    const message = error instanceof Error ? error.message : "Error al eliminar item";
    const status = message === "No autorizado" ? 403
      : message === "Item de carrito no encontrado" ? 404
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
