"use client";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui";

/* ------------------------------------------------------------------
   DataTable — tabla "lista para usar" que recibe columns + data.
   Usa internamente los átomos de Table de ui/.

   Uso:
     <DataTable
       columns={[
         { key: "name", header: "Nombre" },
         { key: "role", header: "Rol", renderCell: (row) => <Badge>{row.role}</Badge> },
       ]}
       data={users}
     />
   ------------------------------------------------------------------ */

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  renderCell?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  emptyMessage = "Sin resultados",
  className,
}: DataTableProps<T>) {
  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead key={col.key} className={col.headerClassName}>
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-center py-8 text-text-muted">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          data.map((row, i) => (
            <TableRow key={i}>
              {columns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  {col.renderCell
                    ? col.renderCell(row)
                    : String((row as Record<string, unknown>)[col.key] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
