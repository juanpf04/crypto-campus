import { NextRequest, NextResponse } from "next/server";
import { getMyUseRequests } from "@/actions/badges";

const VALID_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const subjectOfferingId = searchParams.get("subject") ?? undefined;
		const statusParam = searchParams.get("status");
		const status = VALID_STATUSES.includes(statusParam as ValidStatus)
			? (statusParam as ValidStatus)
			: undefined;

		const result = await getMyUseRequests({ subjectOfferingId, status });
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al obtener solicitudes de uso";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/badges/my/requests]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
