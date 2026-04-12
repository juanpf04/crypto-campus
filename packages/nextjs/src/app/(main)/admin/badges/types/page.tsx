"use client";

/**
 * Lista de todos los tipos de insignia (admin).
 *
 * Tabla con nombre, creador, asignatura, nº tareas y nº otorgamientos.
 * Cada fila es clicable → detalle del badge type.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";

interface BadgeType {
  id: string;
  name: string;
  creator?: { name: string };
  subjectOffering: {
    subject: { name: string };
    professor?: { name: string };
  };
  _count: { tasks: number; awards: number };
}

export default function AdminBadgeTypesPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [badgeTypes, setBadgeTypes] = useState<BadgeType[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/badges/types");
      if (res.ok) setBadgeTypes(await res.json());
    } catch {
      addToast("Error al cargar tipos de insignia", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading && badgeTypes.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink href="/admin/badges" label="Volver a insignias" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Tipos de insignia</h1>
          <p className="text-text-muted mt-1">{badgeTypes.length} tipo(s)</p>
        </div>
        <Button onClick={() => router.push("/admin/badges/types/new")}>
          Crear tipo
        </Button>
      </div>

      {badgeTypes.length === 0 ? (
        <EmptyState
          title="Sin tipos de insignia"
          description="Aún no se ha creado ningún tipo de insignia en la plataforma."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Creador</TableHead>
                <TableHead>Asignatura</TableHead>
                <TableHead>Tareas</TableHead>
                <TableHead>Otorgamientos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {badgeTypes.map((bt) => (
                <TableRow
                  key={bt.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/badges/types/${bt.id}`)}
                >
                  <TableCell className="font-medium">{bt.name}</TableCell>
                  <TableCell className="text-text-muted">
                    {bt.creator?.name ?? bt.subjectOffering?.professor?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-text-muted">
                    {bt.subjectOffering?.subject?.name ?? "—"}
                  </TableCell>
                  <TableCell>{bt._count.tasks}</TableCell>
                  <TableCell>{bt._count.awards}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
