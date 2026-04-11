# API Access Audit

## Summary

The API is protected, but not uniformly. Authorization is implemented in two different ways:

- Some routes validate session/role directly in the route handler.
- Most routes delegate authorization to server actions in `src/actions/*`, and the route only maps `"No autorizado"` to HTTP 403.

That means the system is generally safe, but the security model is decentralized and has duplicated error handling.

## Access Model

### Public

- `GET /api/printer`
- `GET /api/printer/config`
- `POST /api/auth/login`
- `POST /api/auth/register`

### Authenticated, role checked in server actions

These routes do not enforce auth in the handler itself; they rely on `src/actions/*`.

- `GET /api/library/items`
- `POST /api/library/items`
- `GET /api/library/items/[id]`
- `PUT /api/library/items/[id]`
- `DELETE /api/library/items/[id]`
- `PATCH /api/library/items/[id]`
- `GET /api/library/loans`
- `POST /api/library/loans`
- `GET /api/library/loans/my`
- `GET /api/library/loans/requests`
- `POST /api/library/loans/[id]/cancel`
- `POST /api/library/loans/[id]/pickup`
- `POST /api/library/loans/[id]/return`
- `POST /api/library/loans/[id]/expire`
- `POST /api/library/loans/[id]/force-return`
- `GET /api/library/balance`
- `GET /api/library/balance/[userId]`
- `GET /api/library/stats`
- `GET /api/library/tokens`
- `POST /api/library/tokens`
- `GET /api/rooms`
- `POST /api/rooms`
- `GET /api/rooms/[id]`
- `PUT /api/rooms/[id]`
- `DELETE /api/rooms/[id]`
- `GET /api/rooms/[id]/availability`
- `GET /api/rooms/bookings`
- `POST /api/rooms/bookings`
- `GET /api/rooms/bookings/my`
- `POST /api/rooms/bookings/[id]/cancel`
- `GET /api/rooms/stats`
- `GET /api/shop/products`
- `POST /api/shop/products`
- `GET /api/shop/products/[id]`
- `PUT /api/shop/products/[id]`
- `DELETE /api/shop/products/[id]`
- `PATCH /api/shop/products/[id]`
- `GET /api/shop/products/groups`
- `POST /api/shop/products/groups`
- `GET /api/shop/products/groups/[groupKey]`
- `PUT /api/shop/products/groups/[groupKey]`
- `PATCH /api/shop/products/groups/[groupKey]`
- `POST /api/shop/products/groups/[groupKey]/variants`
- `PUT /api/shop/products/variants/[id]`
- `PATCH /api/shop/products/variants/[id]`
- `GET /api/shop/balance`
- `GET /api/shop/balance/[userId]`
- `GET /api/shop/cart`
- `POST /api/shop/cart`
- `PATCH /api/shop/cart`
- `DELETE /api/shop/cart`
- `POST /api/shop/checkout`
- `GET /api/shop/orders`
- `GET /api/shop/orders/[id]`
- `PUT /api/shop/orders/[id]/return`
- `POST /api/shop/purchase`
- `GET /api/shop/batches`
- `GET /api/shop/batches/[id]`
- `PUT /api/shop/batches/[id]`
- `GET /api/shop/stats`
- `POST /api/shop/tokens`
- `POST /api/shop/topup-simulated`
- `GET /api/shop/transactions`
- `POST /api/printer/credits`
- `GET /api/printer/credits`
- `POST /api/printer/execute`
- `POST /api/printer/execute/admin`
- `GET /api/printer/admin`
- `GET /api/printer/[id]`
- `PUT /api/printer/[id]`

### Direct auth in the route handler

These handlers validate session or role themselves.

- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `POST /api/printer/upload`
- `GET /api/printer/files/[filename]`
- `GET /api/printer/logs`
- `GET /api/printer/logs/[id]`
- `GET /api/printer/logs/admin`
- `POST /api/shop/images`

### Mixed behavior in the route handler

- `PUT /api/shop/orders/[id]/return`

This route branches on `session.role` in the handler itself and then delegates to either `processReturn()` or `requestReturn()`.

## What Is Consistent

- Sensitive operations are not openly exposed without auth in the audited routes.
- Role checks are present for admin, librarian, professor, and student flows.
- Session-based auth uses `iron-session` consistently across the project.

## What Is Not Consistent

- Authorization is split between route handlers and server actions.
- Error handling for auth is repeated across many routes by checking the literal message `"No autorizado"`.
- Some modules expose both direct-check routes and delegated-check routes, which makes the access model harder to audit.

## Practical Conclusion

The API is secured, but the implementation is fragmented. There is no obvious open admin endpoint in the routes reviewed, but the current pattern is more brittle than it needs to be because:

- auth logic is not centralized,
- error mapping is duplicated,
- and route-level security is not uniform across modules.

If the goal is maintainability, the next improvement should be to standardize authorization helpers and/or wrap server actions with a shared route guard pattern.
