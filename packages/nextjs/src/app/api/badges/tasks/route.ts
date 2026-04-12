import { NextRequest, NextResponse } from "next/server";
import { listTasks, createTask } from "@/actions/badges";

export async function GET(req: NextRequest) {
	try {
		const badgeTypeId = req.nextUrl.searchParams.get("badgeTypeId") || undefined;
		const result = await listTasks(badgeTypeId);
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al listar tareas";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/badges/tasks]", error);
		return NextResponse.json({ error: message }, { status });
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const result = await createTask(body);
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al crear tarea";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[POST /api/badges/tasks]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
