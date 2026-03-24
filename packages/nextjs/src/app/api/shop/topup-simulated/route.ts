/**
 * POST /api/shop/topup-simulated
 * Recarga simulada de ShopTokens para el usuario autenticado.
 * Body: { cardNumber, expiryMonth, expiryYear, cvv, amount }
 */

import { NextRequest, NextResponse } from "next/server";
import { topupWithSimulatedCard } from "@/actions/shop";

export async function POST(req: NextRequest) {
  try {
    const { cardNumber, expiryMonth, expiryYear, cvv, amount } = await req.json();

    if (!cardNumber || expiryMonth === undefined || expiryYear === undefined || !cvv || amount === undefined) {
      return NextResponse.json(
        { error: "Campos requeridos: cardNumber, expiryMonth, expiryYear, cvv, amount" },
        { status: 400 },
      );
    }

    const result = await topupWithSimulatedCard({
      cardNumber,
      expiryMonth,
      expiryYear,
      cvv,
      amount,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[POST /api/shop/topup-simulated]", error);
    const message = error instanceof Error ? error.message : "Error al recargar saldo";
    const status = message === "No autorizado" ? 403
      : message.includes("invalida") || message.includes("invalido") || message.includes("expirada") ? 400
      : message.includes("limite") ? 429
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
