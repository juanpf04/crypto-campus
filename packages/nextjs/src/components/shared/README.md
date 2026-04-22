Moléculas reutilizables que combinan átomos de ui/ para un propósito concreto.
No son formularios ni organismos completos — son piezas intermedias usadas por dashboard/ y page.tsx.

**No contienen lógica de negocio pesada** (fetches múltiples, estado complejo, orquestación de modales).
Si una molécula empieza a hacer fetches propios, considera promoverla a dashboard/.

Ejemplos: NavCard, StatCard, LinkArrow, SectionTitle, StatusBadge, ProductCard, LibraryItemCard, LoanCard, BookingCard.

Los hooks reutilizables (`usePaginatedList`, `useForm`) viven en `src/hooks/`.
