import { NextResponse } from "next/server";
import { getOfferingRewardsInventory } from "@/actions/badges";

export async function GET(
	_req: Request,
	context: { params: Promise<{ offeringId: string }> },
) {
	const { offeringId } = await context.params;
	try {
		const result = await getOfferingRewardsInventory(offeringId);
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al obtener inventario";
		const status = message === "No autenticado"
			? 401
			: message === "No autorizado"
				? 403
				: message.includes("no encontrada")
					? 404
					: 500;
		if (status === 500) console.error("[GET /api/badges/offerings/[offeringId]/rewards-inventory]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
