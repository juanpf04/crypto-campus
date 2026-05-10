Organisms por dominio: orquestan hooks y actions para pasar datos a los atoms/molecules.
Las pages importan estos organisms y quedan finas (<150 L idealmente).

## Catálogo

### Shop
- `ShopCartDrawer` — Drawer lateral del carrito (fetch + checkout).
- `CartItemList` — Lista de items del carrito a pantalla completa.
- `CartSummary` — Card sticky de totales + botones de checkout.
- `ProductDetailPanel` — Columna derecha del detalle de producto (variantes, cantidad, compra).
- `ProductAdminHeader` — Cabecera de admin con info del grupo + botones.
- `VariantDetailCard` — Card destacada de la variante seleccionada (admin).
- `VariantGrid` — Grid responsivo de variantes + AddCard.
- `OrderBatchTable` — Tabla de batches (admin + student vía `showUser`).
- `OrderItemTable` — Tabla de orders individuales (admin + student via props).
- `OrderBatchDetailView` — Vista completa del detalle de batch con selección múltiple (admin/student).

### Academic
- `SubjectExpandableRow` — Fila desplegable de asignatura con grupos y acciones.
- `StudentRewardsInventoryTable` — Tabla de alumnos con desplegable por fila que muestra el inventario de recompensas (canjeadas, disponibles, pendientes) por alumno dentro de un offering.
