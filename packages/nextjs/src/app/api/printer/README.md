# Printer API REST

API REST para gestionar el sistema de impresión on-chain del campus.

## Endpoints

### Configuración

#### `GET /api/printer/config`
Obtiene la configuración del contrato Printer.
- **Acceso**: Público (lectura)
- **Response**: `{ contractAddress, accessControl, initialCredits }`

### Impresoras

#### `GET /api/printer`
Lista todas las impresoras activas.
- **Acceso**: Público (lectura)
- **Response**: Array de impresoras

#### `POST /api/printer`
Registra una nueva impresora física.
- **Acceso**: Solo administradores
- **Body**: `{ id, name, location, floor? }`
- **Response**: `201` - Impresora creada

#### `PUT /api/printer/[id]`
Actualiza detalles de una impresora.
- **Acceso**: Solo administradores
- **Body**: `{ name?, location?, floor?, active? }` (campos opcionales)
- **Response**: Impresora actualizada

### Logs de Impresión

#### `GET /api/printer/logs`
Obtiene los trabajos de impresión del usuario logueado.
- **Acceso**: Usuarios autenticados
- **Query**: `?limit=20` (opcional, máx 100)
- **Response**: Array de logs

#### `GET /api/printer/logs/admin`
Obtiene todos los trabajos de impresión del sistema.
- **Acceso**: Solo administradores
- **Query**: `?limit=50` (opcional, máx 200)
- **Response**: Array de logs con detalles de usuario e impresora

### Créditos

#### `GET /api/printer/credits`
Obtiene los créditos de impresión del usuario logueado.
- **Acceso**: Usuarios autenticados
- **Response**: `{ userAddress, availableCredits, isStudent }`

#### `GET /api/printer/credits/[userId]`
Obtiene los créditos de un estudiante específico.
- **Acceso**: Solo administradores
- **Response**: `{ userId, userAddress, availableCredits, isStudent }`

#### `POST /api/printer/credits`
Asigna créditos a un estudiante.
- **Acceso**: Solo administradores
- **Body**: `{ userId, credits }`
- **Response**: `{ txHash, userId, userAddress, credits }`

### Ejecución de Trabajos

#### `POST /api/printer/execute`
Ejecuta un trabajo de impresión para el usuario logueado.
- **Acceso**: Usuarios autenticados
- **Body**: `{ printerId, filename, pages, copies? }`
- **Response**: `201` - `{ txHash, printLog }`

#### `POST /api/printer/execute/admin`
Ejecuta un trabajo de impresión en nombre de un usuario.
- **Acceso**: Solo administradores
- **Body**: `{ userId, printerId, filename, pages, copies? }`
- **Response**: `201` - `{ txHash, printLog }`

## Errores Comunes

| Status | Descripción |
|--------|-------------|
| `400` | Validación fallida (campos faltantes o inválidos) |
| `401` | No autenticado |
| `403` | No autorizado (falta rol requerido) |
| `500` | Error al procesar la solicitud |

## Ejemplo de Uso (cURL)

### Listar impresoras
```bash
curl -X GET http://localhost:3000/api/printer
```

### Obtener mis créditos
```bash
curl -X GET http://localhost:3000/api/printer/credits \
  -H "Cookie: sessionId=..."
```

### Ejecutar trabajo de impresión
```bash
curl -X POST http://localhost:3000/api/printer/execute \
  -H "Content-Type: application/json" \
  -H "Cookie: sessionId=..." \
  -d '{ "printerId": "printer-1", "filename": "documento.pdf", "pages": 5 }'
```

### Crear impresora (admin)
```bash
curl -X POST http://localhost:3000/api/printer \
  -H "Content-Type: application/json" \
  -H "Cookie: sessionId=..." \
  -d '{ "id": "printer-lab-1", "name": "Impresora Laboratorio 1", "location": "B-101", "floor": "1" }'
```

### Asignar créditos (admin)
```bash
curl -X POST http://localhost:3000/api/printer/credits \
  -H "Content-Type: application/json" \
  -H "Cookie: sessionId=..." \
  -d '{ "userId": "user-123", "credits": 100 }'
```
