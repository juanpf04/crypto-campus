/**
 * rate-limit.ts — Rate limiter en memoria para proteger endpoints de autenticación.
 *
 * Limita el número de intentos por IP en una ventana de tiempo.
 * Almacena los contadores en un Map en memoria (no persistido).
 * Limpia entradas expiradas automáticamente cada minuto.
 */

interface RateLimitEntry {
	count: number;
	resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

// Limpieza periódica de entradas expiradas (cada 60s)
if (typeof setInterval !== "undefined") {
	setInterval(() => {
		const now = Date.now();
		for (const [key, entry] of store) {
			if (now > entry.resetTime) store.delete(key);
		}
	}, 60_000);
}

/**
 * Verifica si una IP ha excedido el límite de intentos.
 * @param ip Dirección IP del cliente
 * @param maxAttempts Máximo de intentos permitidos (default: 10)
 * @param windowMs Ventana de tiempo en ms (default: 60000 = 1 minuto)
 * @returns { allowed, remaining, resetIn } — allowed=false si se excedió el límite
 */
export function checkRateLimit(
	ip: string,
	maxAttempts = 10,
	windowMs = 60_000,
): { allowed: boolean; remaining: number; resetIn: number } {
	const now = Date.now();
	const entry = store.get(ip);

	if (!entry || now > entry.resetTime) {
		store.set(ip, { count: 1, resetTime: now + windowMs });
		return { allowed: true, remaining: maxAttempts - 1, resetIn: windowMs };
	}

	entry.count++;

	if (entry.count > maxAttempts) {
		return { allowed: false, remaining: 0, resetIn: entry.resetTime - now };
	}

	return { allowed: true, remaining: maxAttempts - entry.count, resetIn: entry.resetTime - now };
}
