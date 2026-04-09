# RUTAS

Este documento resume las rutas reales del proyecto Next.js.

- Solo se listan archivos `page.tsx` y `route.ts` que generan URLs funcionales.
- Las carpetas de grupo como `(auth)` y `(main)` no aparecen en la URL final.
- El acceso a `/dashboard/*` está protegido y redirigido por `src/proxy.ts` según la sesión y el rol. -> que se protegan 
    por rol las rutas específicas

## Páginas públicas

| Ruta | Propósito |
| --- | --- |
| `/` | Landing principal de CryptoCampus con accesos a inicio de sesión y registro. -> ELIMINAR
| `/login` | Formulario de acceso para usuarios registrados. |
| `/register` | Formulario de alta para estudiantes con email `@ucm.es`. |

## Navegación de dashboard

| Ruta | Propósito |
| --- | --- |
| `/dashboard -> /` | Página puente que consulta el rol y redirige al panel correspondiente. -> Si no estás logado, 
que muestre la biblioteca, la tienda y las insignias y salga un mensaje de quien puede acceder a que, si entras a algun
servicio te pide logearte o si te logeas desde abajo izqierda redirige a la visata que sea
| `/dashboard/student -> /student` | Panel principal del estudiante. |
| `/dashboard/professor  -> /professore` | Panel principal del profesor. |
| `/dashboard/librarian -> /librarian` | Panel principal del bibliotecario. |
| `/dashboard/admin -> /admin` | Panel principal del administrador. |

en el resto quitar del /dashboard/ y ya

## Dashboard del estudiante

| Ruta | Propósito |
| --- | --- |
| `/dashboard/student/library` | Resumen y acceso a la biblioteca del estudiante. |
| `/dashboard/student/library/[id]` | Detalle de un ítem de biblioteca y acción sobre ese recurso. |
| `/dashboard/student/library/rooms` | Reserva de salas de estudio. |
| `/dashboard/student/printing` | Gestión de impresión del estudiante y subida de archivos. |
| `/dashboard/student/printing/history` | Historial de trabajos de impresión. |
| `/dashboard/student/printing/history/[id]` | Detalle de un trabajo de impresión concreto. |
| `/dashboard/student/shop` | Catálogo de la tienda para estudiantes. |
| `/dashboard/student/shop/[id]` | Detalle de un producto de la tienda. |
| `/dashboard/student/shop/cart` | Carrito de compra. |
| `/dashboard/student/shop/orders` | Historial de pedidos del estudiante. |
| `/dashboard/student/shop/orders/[id]` | Detalle de un pedido. |
| `/dashboard/student/shop/orders/batch/[id]` | Detalle de un pedido agrupado. |
| `/dashboard/student/shop/topup` | Recarga simulada de ShopTokens. |

## Dashboard del profesor

| Ruta | Propósito |
| --- | --- |
| `/dashboard/professor` | Panel principal del profesor con métricas de insignias, tareas y recompensas. |

## Dashboard del bibliotecario

| Ruta | Propósito |
| --- | --- |
| `/dashboard/librarian` | Panel principal del bibliotecario. |
| `/dashboard/librarian/items` | Gestión de ítems de biblioteca. |
| `/dashboard/librarian/items/new` | Alta de un nuevo ítem de biblioteca. |
| `/dashboard/librarian/items/[id]/edit` | Edición de un ítem de biblioteca existente. |
| `/dashboard/librarian/loans` | Gestión general de préstamos. |
| `/dashboard/librarian/loans/requests` | Revisión de solicitudes de préstamo pendientes. |
| `/dashboard/librarian/rooms` | Gestión de salas. |
| `/dashboard/librarian/rooms/new` | Alta de una nueva sala. |
| `/dashboard/librarian/rooms/[id]/edit` | Edición de una sala existente. |

## Dashboard del administrador

| Ruta | Propósito |
| --- | --- |
| `/dashboard/admin` | Panel principal del administrador. |
| `/dashboard/admin/library` | Vista general de administración de biblioteca. |
| `/dashboard/admin/library/items` | Gestión completa de ítems de biblioteca. |
| `/dashboard/admin/library/items/new` | Creación de un ítem de biblioteca. |
| `/dashboard/admin/library/items/[id]/edit` | Edición de un ítem de biblioteca. |
| `/dashboard/admin/library/loans` | Gestión de préstamos de biblioteca. |
| `/dashboard/admin/library/loans/requests` | Solicitudes de préstamo pendientes de aprobación. |
| `/dashboard/admin/library/rooms` | Gestión completa de salas. |
| `/dashboard/admin/library/rooms/new` | Creación de una sala. |
| `/dashboard/admin/library/rooms/[id]/edit` | Edición de una sala. |
| `/dashboard/admin/library/tokens` | Administración de LibraryTokens de estudiantes. |
| `/dashboard/admin/printing` | Vista general de impresión. |
| `/dashboard/admin/printing/credits` | Asignación y control de créditos de impresión. |
| `/dashboard/admin/printing/printers` | Gestión de impresoras registradas. |
| `/dashboard/admin/printing/printers/new` | Alta de una impresora. |
| `/dashboard/admin/printing/printers/[id]/edit` | Edición de una impresora. |
| `/dashboard/admin/users` | Gestión de usuarios del sistema. |
| `/dashboard/admin/users/new` | Creación de usuarios con cualquier rol permitido. |
| `/dashboard/admin/shop` | Vista general de administración de tienda. |
| `/dashboard/admin/shop/products` | Gestión completa de productos. |
| `/dashboard/admin/shop/products/new` | Creación de un producto o grupo de producto. |
| `/dashboard/admin/shop/products/[id]` | Detalle de un producto. |
| `/dashboard/admin/shop/products/[id]/edit` | Edición de un producto. |
| `/dashboard/admin/shop/products/[id]/edit-group` | Edición de datos compartidos del grupo del producto. |
| `/dashboard/admin/shop/products/[id]/add-variant` | Alta de una nueva variante del producto. |
| `/dashboard/admin/shop/products/variants/[id]/edit` | Edición de una variante concreta. |
| `/dashboard/admin/shop/orders` | Gestión de pedidos de la tienda. |
| `/dashboard/admin/shop/orders/[id]` | Detalle de un pedido. |
| `/dashboard/admin/shop/orders/batch/[id]` | Detalle de un pedido agrupado. |
| `/dashboard/admin/shop/tokens` | Administración de ShopTokens. |
| `/dashboard/admin/shop/transactions` | Registro unificado de compras, recargas y devoluciones. |

## API de autenticación

| Ruta | Métodos | Propósito |
| --- | --- | --- |
| `/api/auth/login` | `POST` | Inicia sesión y crea la cookie de sesión. |
| `/api/auth/logout` | `POST` | Cierra la sesión activa. |
| `/api/auth/me` | `GET` | Devuelve el usuario autenticado actual. |
| `/api/auth/register` | `POST` | Registra un estudiante con wallet, tokens iniciales y sesión en base de datos. |

## API de administración

| Ruta | Métodos | Propósito |
| --- | --- | --- |
| `/api/admin/users` | `GET`, `POST` | Lista usuarios o crea un usuario con cualquier rol permitido. |

## API de biblioteca

| Ruta | Métodos | Propósito |
| --- | --- | --- |
| `/api/library/balance` | `GET` | Devuelve el balance de LibraryTokens del usuario autenticado. |
| `/api/library/balance/[userId]` | `GET` | Devuelve el balance de LibraryTokens de un usuario concreto. |
| `/api/library/items` | `GET`, `POST` | Lista ítems de biblioteca o crea un nuevo ítem. |
| `/api/library/items/[id]` | `GET`, `PUT`, `DELETE`, `PATCH` | Consulta, actualiza, desactiva o reactiva un ítem. |
| `/api/library/loans` | `GET`, `POST` | Lista préstamos o solicita un nuevo préstamo. |
| `/api/library/loans/my` | `GET` | Devuelve los préstamos del usuario autenticado. |
| `/api/library/loans/requests` | `GET` | Lista solicitudes de préstamo pendientes. |
| `/api/library/loans/[id]/approve` | `POST` | Aprueba una solicitud de préstamo. |
| `/api/library/loans/[id]/reject` | `POST` | Rechaza una solicitud de préstamo. |
| `/api/library/loans/[id]/return` | `POST` | Confirma la devolución de un préstamo. |
| `/api/library/loans/[id]/cancel` | `POST` | Cancela una solicitud de préstamo. |
| `/api/library/loans/[id]/force-return` | `POST` | Fuerza la devolución de un préstamo. |
| `/api/library/stats` | `GET` | Devuelve estadísticas agregadas de biblioteca. |
| `/api/library/tokens` | `GET`, `POST` | Lista balances de estudiantes o mintea LibraryTokens. |

## API de salas

| Ruta | Métodos | Propósito |
| --- | --- | --- |
| `/api/rooms` | `GET`, `POST` | Lista salas o crea una nueva sala. |
| `/api/rooms/[id]` | `GET`, `PUT`, `DELETE` | Consulta, actualiza o elimina una sala. |
| `/api/rooms/[id]/availability` | `GET` | Devuelve disponibilidad de una sala para una fecha concreta. |
| `/api/rooms/bookings` | `GET`, `POST` | Lista reservas o crea una nueva reserva. |
| `/api/rooms/bookings/my` | `GET` | Devuelve las reservas del usuario autenticado. |
| `/api/rooms/bookings/[id]/cancel` | `POST` | Cancela una reserva existente. |
| `/api/rooms/stats` | `GET` | Devuelve estadísticas de uso de salas. |

## API de impresión

| Ruta | Métodos | Propósito |
| --- | --- | --- |
| `/api/printer` | `GET`, `POST` | Lista impresoras activas o registra una nueva impresora. |
| `/api/printer/admin` | `GET` | Lista todas las impresoras, activas e inactivas. |
| `/api/printer/[id]` | `PUT` | Actualiza una impresora existente. |
| `/api/printer/config` | `GET` | Devuelve la configuración del sistema de impresión. |
| `/api/printer/credits` | `GET`, `POST` | Consulta créditos propios o asigna créditos a un estudiante. |
| `/api/printer/credits/[userId]` | `GET` | Devuelve los créditos de impresión de un usuario concreto. |
| `/api/printer/execute` | `POST` | Ejecuta un trabajo de impresión para el usuario autenticado. |
| `/api/printer/execute/admin` | `POST` | Ejecuta un trabajo de impresión en nombre de otro usuario. |
| `/api/printer/files/[filename]` | `GET` | Sirve un archivo subido para impresión. |
| `/api/printer/logs` | `GET` | Lista los trabajos de impresión del usuario autenticado. |
| `/api/printer/logs/[id]` | `GET` | Devuelve el detalle de un trabajo de impresión. |
| `/api/printer/logs/admin` | `GET` | Lista todos los trabajos de impresión del sistema. |
| `/api/printer/upload` | `POST` | Sube un archivo temporal para imprimirlo después. |

## API de tienda

| Ruta | Métodos | Propósito |
| --- | --- | --- |
| `/api/shop/balance` | `GET` | Devuelve el balance de ShopTokens del usuario autenticado. |
| `/api/shop/balance/[userId]` | `GET` | Devuelve el balance de ShopTokens de un usuario concreto. |
| `/api/shop/cart` | `GET`, `POST`, `PATCH`, `DELETE` | Obtiene, modifica, elimina o vacía el carrito del usuario. |
| `/api/shop/categories` | `GET` | Lista las categorías disponibles de la tienda. |
| `/api/shop/checkout` | `POST` | Procesa el checkout completo del carrito. |
| `/api/shop/images` | `POST` | Sube imágenes para productos de la tienda. |
| `/api/shop/orders` | `GET` | Lista los pedidos del usuario autenticado. |
| `/api/shop/orders/[id]` | `GET` | Devuelve el detalle de un pedido individual. |
| `/api/shop/orders/[id]/deliver` | `PUT` | Marca un pedido como entregado. |
| `/api/shop/orders/[id]/return` | `PUT` | Solicita o procesa la devolución de un pedido. |
| `/api/shop/orders/admin` | `GET` | Lista pedidos con vista administrativa. |
| `/api/shop/purchase` | `POST` | Compra rápida sin pasar por el carrito. |
| `/api/shop/products` | `GET`, `POST` | Lista productos activos o crea un producto nuevo. |
| `/api/shop/products/[id]` | `GET`, `PUT`, `DELETE`, `PATCH` | Consulta, actualiza, desactiva o reactiva un producto. |
| `/api/shop/products/admin` | `GET` | Lista productos para administración. |
| `/api/shop/products/groups` | `POST` | Crea un grupo de producto con su primera variante. |
| `/api/shop/products/groups/[groupKey]` | `GET`, `PUT`, `PATCH` | Consulta, actualiza o activa/desactiva un grupo de producto. |
| `/api/shop/products/groups/[groupKey]/variants` | `POST` | Crea una nueva variante dentro de un grupo de producto. |
| `/api/shop/products/variants/[id]` | `PUT`, `PATCH` | Actualiza o activa/desactiva una variante concreta. |
| `/api/shop/stats` | `GET` | Devuelve estadísticas de la tienda. |
| `/api/shop/tokens` | `POST` | Mintea ShopTokens para un usuario. |
| `/api/shop/topup-simulated` | `POST` | Simula una recarga de saldo de la tienda. |
| `/api/shop/transactions` | `GET` | Devuelve el log unificado de compras, recargas y devoluciones. |
| `/api/shop/batches` | `GET` | Lista los pedidos agrupados del usuario autenticado. |
| `/api/shop/batches/[id]` | `GET`, `PUT` | Consulta el detalle de un pedido agrupado o lo marca como entregado. |
| `/api/shop/batches/admin` | `GET` | Lista todos los pedidos agrupados con vista administrativa. |

## Nota rápida

Si se añaden nuevas páginas o endpoints, basta con completar este archivo con la nueva ruta real y su propósito. Mantenerlo alineado con `src/app` ayuda a revisar navegación, permisos y cobertura funcional sin recorrer todo el árbol del proyecto.