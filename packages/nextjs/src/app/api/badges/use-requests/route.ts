import { NextRequest, NextResponse } from "next/server";
import { requestUseReward, listUseRequests } from "@/actions/badges";

const VALID_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const subject = searchParams.get("subject") ?? undefined;
		const professor = searchParams.get("professor") ?? undefined;
		const statusParam = searchParams.get("status");
		const status = VALID_STATUSES.includes(statusParam as ValidStatus)
			? (statusParam as ValidStatus)
			: undefined;

		const result = await listUseRequests({
			subjectOfferingId: subject,
			professorId: professor,
			status,
		});
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al obtener solicitudes de uso";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/badges/use-requests]", error);
		return NextResponse.json({ error: message }, { status });
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const result = await requestUseReward(body.rewardId);
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al solicitar uso de recompensa";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[POST /api/badges/use-requests]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
