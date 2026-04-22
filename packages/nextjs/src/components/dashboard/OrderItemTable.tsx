"use client";

/**
 * OrderItemTable — Tabla de items sueltos (orders individuales).
 *
 * Usada tanto por admin como por student. Diferencias por prop:
 * - `showUser`: columna Usuario (admin)
 * - `showTxHash`: columna Tx Hash (admin)
 * - `onDeliver`/`onReturn`: columna Acciones (admin)
 * - `basePath` + `navigationQuery`: URL destino al clickar la fila
 */

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { LinkArrow } from "@/components/shared/LinkArrow";
import { ORDER_STATUS_MAP } from "@/lib/shop-constants";
import { formatShortDate } from "@/lib/formatters";

export interface OrderTableRow {
  id: string;
  purchaseDate: string;
  status: "PAID" | "DELIVERED" | "RETURNED";
  pricePaid: number;
  product: { name: string };
  user?: { name: string; email: string };
  txHash?: string;
}

interface OrderItemTableProps {
  orders: OrderTableRow[];
  /** URL base para navegar al detalle. Se concatena con `/${orderId}${query}`. */
  basePath: string;
  /** Querystring extra al navegar, p.ej. "?from=items". */
  navigationQuery?: string;
  showUser?: boolean;
  showTxHash?: boolean;
  onDeliver?: (orderId: string) => void;
  onReturn?: (orderId: string, productName: string) => void;
}

export function OrderItemTable({
  orders,
  basePath,
  navigationQuery = "",
  showUser = false,
  showTxHash = false,
  onDeliver,
  onReturn,
}: OrderItemTableProps) {
  const router = useRouter();
  const showActions = Boolean(onDeliver || onReturn);

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            {showUser && <TableHead>Usuario</TableHead>}
            <TableHead>Producto</TableHead>
            <TableHead>Precio</TableHead>
            <TableHead>Estado</TableHead>
            {showTxHash && <TableHead>Tx Hash</TableHead>}
            {showActions && <TableHead>Acciones</TableHead>}
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const status = ORDER_STATUS_MAP[order.status] ?? ORDER_STATUS_MAP.PAID;
            return (
              <TableRow
                key={order.id}
                className="cursor-pointer hover:bg-primary/5 transition-colors"
                onClick={() => router.push(`${basePath}/${order.id}${navigationQuery}`)}
              >
                <TableCell className="text-text-muted text-sm whitespace-nowrap">
                  {formatShortDate(order.purchaseDate)}
                </TableCell>
                {showUser && order.user && (
                  <TableCell className="text-sm">
                    <span className="font-medium">{order.user.name}</span>
                    <br />
                    <span className="text-text-muted text-xs">{order.user.email}</span>
                  </TableCell>
                )}
                <TableCell className="font-medium max-w-[200px] truncate">
                  {order.product.name}
                </TableCell>
                <TableCell>
                  <span className="font-semibold text-primary">{order.pricePaid} ShopTokens</span>
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                {showTxHash && order.txHash && (
                  <TableCell className="font-mono text-xs text-text-muted">
                    {order.txHash.slice(0, 6)}…{order.txHash.slice(-4)}
                  </TableCell>
                )}
                {showActions && (
                  <TableCell>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {onDeliver && order.status === "PAID" && (
                        <Button size="sm" onClick={() => onDeliver(order.id)}>
                          Entregar
                        </Button>
                      )}
                      {onReturn && (order.status === "PAID" || order.status === "DELIVERED") && (
                        <Button variant="danger" size="sm" onClick={() => onReturn(order.id, order.product.name)}>
                          Devolver
                        </Button>
                      )}
                      {order.status === "RETURNED" && (
                        <span className="text-xs text-text-muted">Devuelto</span>
                      )}
                    </div>
                  </TableCell>
                )}
                <TableCell>
                  <LinkArrow variant="static" size="sm" className="relative right-auto top-auto" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
