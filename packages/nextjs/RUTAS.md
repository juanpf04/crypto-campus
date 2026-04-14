# RUTAS

Este documento resume las rutas reales y activas del proyecto Next.js.

- Se listan solo rutas generadas por `page.tsx` y `route.ts`.
- Las carpetas de grupo `(auth)` y `(main)` no aparecen en la URL final.
- Las rutas de rol se protegen en middleware (`src/proxy.ts`) y solo permiten acceso al rol correcto.

## Protección por rol

Rutas protegidas por middleware:

- `/student/:path*` solo para `STUDENT`.
- `/professor/:path*` solo para `PROFESSOR`.
- `/librarian/:path*` solo para `LIBRARIAN`.
- `/admin/:path*` solo para `ADMIN`.

Comportamiento de acceso:

- Usuario no autenticado intentando entrar en rutas de rol: redirección a `/login?returnUrl=...`.
- Usuario autenticado intentando entrar en `/login`: redirección a `/{suRol}`.
- Usuario autenticado intentando entrar en la ruta de otro rol: redirección a `/{suRol}`.

## Rutas públicas

| Ruta | Propósito |
| --- | --- |
| `/login` | Formulario de acceso para usuarios registrados. |

## Rutas principales por rol

| Ruta | Propósito |
| --- | --- |
| `/student` | Panel principal del estudiante. |
| `/professor` | Panel principal del profesor. |
| `/librarian` | Panel principal del bibliotecario. |
| `/admin` | Panel principal del administrador. |

## Rutas del estudiante

| Ruta | Propósito |
| --- | --- |
| `/student/library` | Resumen y acceso a biblioteca para estudiante. |
| `/student/library/[id]` | Detalle de un ítem de biblioteca. |
| `/student/library/rooms` | Reserva de salas de estudio. |
| `/student/library/printing` | Gestión de impresión del estudiante. |
| `/student/library/printing/history` | Historial de trabajos de impresión. |
| `/student/library/printing/history/[id]` | Detalle de un trabajo de impresión. |
| `/student/shop` | Catálogo de la tienda para estudiante. |
| `/student/shop/[id]` | Detalle de producto de tienda. |
| `/student/shop/cart` | Carrito de compra. |
| `/student/shop/orders` | Historial de pedidos. |
| `/student/shop/orders/[id]` | Detalle de pedido individual. |
| `/student/shop/orders/batch/[id]` | Detalle de pedido agrupado. |
| `/student/shop/topup` | Recarga simulada de saldo/tokens de tienda. |

## Rutas del profesor

| Ruta | Propósito |
| --- | --- |
| `/professor` | Panel del profesor para insignias, tareas y recompensas. |

## Rutas del bibliotecario

| Ruta | Propósito |
| --- | --- |
| `/librarian` | Panel principal del bibliotecario. |
| `/librarian/items` | Gestión de ítems de biblioteca. |
| `/librarian/items/new` | Alta de ítem de biblioteca. |
| `/librarian/items/[id]/edit` | Edición de ítem de biblioteca. |
| `/librarian/loans` | Gestión general de préstamos. |
| `/librarian/loans/pickups` | Gestión de préstamos pendientes de recogida. |
| `/librarian/loans/returns` | Gestión de devoluciones. |
| `/librarian/rooms` | Gestión de salas. |
| `/librarian/rooms/new` | Alta de sala. |
| `/librarian/rooms/[id]/edit` | Edición de sala. |
| `/librarian/printing` | Panel de impresión del bibliotecario. |
| `/librarian/printing/print` | Flujo operativo para lanzar impresión. |
| `/librarian/printing/history` | Historial de trabajos de impresión. |
| `/librarian/printing/history/[id]` | Detalle de trabajo de impresión. |
| `/librarian/printing/printers` | Gestión de impresoras. |
| `/librarian/printing/printers/new` | Alta de impresora. |
| `/librarian/printing/printers/[id]/edit` | Edición de impresora. |

## Rutas del administrador

| Ruta | Propósito |
| --- | --- |
| `/admin` | Panel principal del administrador. |
| `/admin/users` | Gestión de usuarios del sistema. |
| `/admin/users/new` | Alta de usuario con rol. |
| `/admin/library` | Vista general de administración de biblioteca. |
| `/admin/library/items` | Gestión de ítems de biblioteca. |
| `/admin/library/items/new` | Alta de ítem de biblioteca. |
| `/admin/library/items/[id]/edit` | Edición de ítem de biblioteca. |
| `/admin/library/loans` | Gestión global de préstamos. |
| `/admin/library/loans/requests` | Solicitudes de préstamo pendientes. |
| `/admin/library/rooms` | Gestión de salas. |
| `/admin/library/rooms/new` | Alta de sala. |
| `/admin/library/rooms/[id]/edit` | Edición de sala. |
| `/admin/library/tokens` | Administración de LibraryTokens. |
| `/admin/printing` | Vista general de impresión. |
| `/admin/printing/credits` | Gestión de créditos de impresión. |
| `/admin/printing/printers` | Gestión de impresoras. |
| `/admin/printing/printers/new` | Alta de impresora. |
| `/admin/printing/printers/[id]/edit` | Edición de impresora. |
| `/admin/shop` | Vista general de administración de tienda. |
| `/admin/shop/products` | Gestión de productos. |
| `/admin/shop/products/new` | Alta de producto o grupo. |
| `/admin/shop/products/[id]` | Detalle de producto. |
| `/admin/shop/products/[id]/edit` | Edición de producto. |
| `/admin/shop/products/[id]/edit-group` | Edición de grupo de producto. |
| `/admin/shop/products/[id]/add-variant` | Alta de variante. |
| `/admin/shop/products/variants/[id]/edit` | Edición de variante. |
| `/admin/shop/orders` | Gestión de pedidos. |
| `/admin/shop/orders/[id]` | Detalle de pedido. |
| `/admin/shop/orders/batch/[id]` | Detalle de pedido agrupado. |
| `/admin/shop/tokens` | Administración de ShopTokens. |
| `/admin/shop/transactions` | Historial unificado de transacciones. |

## API de autenticación

| Ruta | Métodos | Propósito |
| --- | --- | --- |
| `/api/auth/login` | `POST` | Inicia sesión y crea cookie de sesión. |
| `/api/auth/logout` | `POST` | Cierra sesión y elimina cookie. |
| `/api/auth/me` | `GET` | Devuelve el usuario autenticado actual. |
| `/api/auth/register` | `POST` | Registra estudiante, wallet y dato
## API de administración

| Ruta | Métodos | Propósito |
| --- | --- | --- |
| `/api/admin/users` | `GET`, `POST` | Lista usuarios o crea usuario con rol. |

## API de biblioteca

| Ruta | Métodos | Propósito |
| --- | --- | --- |
| `/api/library/balance` | `GET` | Balance de LibraryTokens del usuario actual. |
| `/api/library/balance/[userId]` | `GET` | Balance de LibraryTokens de usuario específico. |
| `/api/library/items` | `GET`, `POST` | Lista ítems o crea ítem. |
| `/api/library/items/[id]` | `GET`, `PUT`, `DELETE`, `PATCH` | Consulta, actualiza, desactiva o reactiva ítem. |
| `/api/library/loans` | `GET`, `POST` | Lista préstamos o solicita préstamo. |
| `/api/library/loans/my` | `GET` | Préstamos del usuario autenticado. |
| `/api/library/loans/requests` | `GET` | Solicitudes pendientes de préstamo. |
| `/api/library/loans/[id]/pickup` | `POST` | Marca préstamo como recogido. |
| `/api/library/loans/[id]/return` | `POST` | Confirma devolución de préstamo. |
| `/api/library/loans/[id]/cancel` | `POST` | Cancela solicitud de préstamo. |
| `/api/library/loans/[id]/force-return` | `POST` | Fuerza devolución administrativa. |
| `/api/library/loans/[id]/expire` | `POST` | Marca solicitud/préstamo como expirado según reglas. |
| `/api/library/stats` | `GET` | Estadísticas agregadas de biblioteca. |
| `/api/library/tokens` | `GET`, `POST` | Lista balances o mintea LibraryTokens. |

## API de salas

| Ruta | Métodos | Propósito |
| --- | --- | --- |
| `/api/rooms` | `GET`, `POST` | Lista salas o crea sala. |
| `/api/rooms/[id]` | `GET`, `PUT`, `DELETE` | Consulta, actualiza o elimina sala. |
| `/api/rooms/[id]/availability` | `GET` | Disponibilidad de sala para una fecha. |
| `/api/rooms/bookings` | `GET`, `POST` | Lista reservas o crea reserva. |
| `/api/rooms/bookings/my` | `GET` | Reservas del usuario autenticado. |
| `/api/rooms/bookings/[id]/cancel` | `POST` | Cancela reserva existente. |
| `/api/rooms/stats` | `GET` | Estadísticas de uso de salas. |

## API de impresión

| Ruta | Métodos | Propósito |
| --- | --- | --- |
| `/api/printer` | `GET`, `POST` | Lista impresoras activas o crea impresora. |
| `/api/printer/admin` | `GET` | Lista todas las impresoras (activas/inactivas). |
| `/api/printer/[id]` | `PUT` | Actualiza impresora existente. |
| `/api/printer/config` | `GET` | Obtiene configuración del sistema de impresión. |
| `/api/printer/credits` | `GET`, `POST` | Consulta créditos propios o asigna créditos a usuario. |
| `/api/printer/credits/[userId]` | `GET` | Consulta créditos de usuario concreto. |
| `/api/printer/execute` | `POST` | Ejecuta impresión del usuario autenticado. |
| `/api/printer/execute/admin` | `POST` | Ejecuta impresión en nombre de otro usuario. |
| `/api/printer/files/[filename]` | `GET` | Sirve archivo subido para impresión. |
| `/api/printer/logs` | `GET` | Historial de impresión del usuario autenticado. |
| `/api/printer/logs/[id]` | `GET` | Detalle de trabajo de impresión. |
| `/api/printer/logs/admin` | `GET` | Historial global de impresión (admin). |
| `/api/printer/upload` | `POST` | Sube archivo temporal para imprimir. |

## API de tienda

| Ruta | Métodos | Propósito |
| --- | --- | --- |
| `/api/shop/balance` | `GET` | Balance de ShopTokens del usuario actual. |
| `/api/shop/balance/[userId]` | `GET` | Balance de ShopTokens de usuario específico. |
| `/api/shop/cart` | `GET`, `POST`, `PATCH`, `DELETE` | Obtiene y gestiona carrito. |
| `/api/shop/categories` | `GET` | Lista categorías de tienda. |
| `/api/shop/checkout` | `POST` | Procesa checkout completo de carrito. |
| `/api/shop/images` | `POST` | Sube imágenes para productos. |
| `/api/shop/orders` | `GET` | Lista pedidos del usuario autenticado. |
| `/api/shop/orders/[id]` | `GET` | Detalle de pedido individual. |
| `/api/shop/orders/[id]/deliver` | `PUT` | Marca pedido como entregado. |
| `/api/shop/orders/[id]/return` | `PUT` | Solicita/procesa devolución de pedido. |
| `/api/shop/orders/admin` | `GET` | Lista pedidos en vista administrativa. |
| `/api/shop/purchase` | `POST` | Compra rápida sin carrito. |
| `/api/shop/products` | `GET`, `POST` | Lista productos o crea producto. |
| `/api/shop/products/[id]` | `GET`, `PUT`, `DELETE`, `PATCH` | Consulta y gestiona estado de producto. |
| `/api/shop/products/admin` | `GET` | Lista productos en modo administración. |
| `/api/shop/products/groups` | `POST` | Crea grupo de producto y variante inicial. |
| `/api/shop/products/groups/[groupKey]` | `GET`, `PUT`, `PATCH` | Consulta/edita/activa-desactiva grupo. |
| `/api/shop/products/groups/[groupKey]/variants` | `POST` | Crea variante en grupo de producto. |
| `/api/shop/products/variants/[id]` | `PUT`, `PATCH` | Edita o activa/desactiva variante. |
| `/api/shop/stats` | `GET` | Estadísticas agregadas de tienda. |
| `/api/shop/tokens` | `POST` | Mintea ShopTokens para usuario. |
| `/api/shop/topup-simulated` | `POST` | Recarga simulada de saldo. |
| `/api/shop/transactions` | `GET` | Log unificado de transacciones. |
| `/api/shop/batches` | `GET` | Lista pedidos agrupados del usuario. |
| `/api/shop/batches/[id]` | `GET`, `PUT` | Detalle de batch o marcar entregado. |
| `/api/shop/batches/admin` | `GET` | Lista batches globales en modo admin. |

## Mantenimiento

Si se añade o elimina una ruta en `src/app`, actualizar este documento en el mismo cambio para mantenerlo sincronizado.