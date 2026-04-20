"use client";

/**
 * Recarga simulada de ShopTokens.
 *
 * Layout centrado con card principal que muestra:
 * - Tabla de equivalencia (1€ = 5 ShopTokens)
 * - Paquetes predefinidos con bonus
 * - Opción personalizada con cálculo en tiempo real
 * - Confirmación con nuevo saldo
 */

import { useState } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";

/** Paquetes predefinidos de recarga */
const PACKAGES = [
  { euros: 2, tokens: 20, bonus: 0, label: "Básico" },
  { euros: 5, tokens: 54, bonus: 4, label: "Estándar" },
  { euros: 10, tokens: 112, bonus: 12, label: "Premium" },
] as const;

/** Tasa base: 1€ = 10 ShopTokens */
const RATE = 10;

export default function StudentShopTopupPage() {
  const { addToast } = useToast();

  // null = ninguno seleccionado, número = índice del paquete, "custom" = personalizado
  const [selected, setSelected] = useState<number | "custom" | null>(null);
  const [customEuros, setCustomEuros] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [newBalance, setNewBalance] = useState<number | null>(null);

  // Calcular los tokens que recibirá
  function getTokenAmount(): number {
    if (selected === "custom") {
      const euros = parseFloat(customEuros);
      if (isNaN(euros) || euros < 1) return 0;
      return Math.floor(euros * RATE);
    }
    if (typeof selected === "number") {
      return PACKAGES[selected].tokens;
    }
    return 0;
  }

  function getEuroAmount(): number {
    if (selected === "custom") {
      const euros = parseFloat(customEuros);
      if (isNaN(euros) || euros < 1) return 0;
      return euros;
    }
    if (typeof selected === "number") {
      return PACKAGES[selected].euros;
    }
    return 0;
  }

  const tokenAmount = getTokenAmount();
  const euroAmount = getEuroAmount();
  const canSubmit = tokenAmount > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/shop/topup-simulated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: tokenAmount,
          // Datos de tarjeta simulados (el backend los ignora)
          cardNumber: "4111111111111111",
          expiryMonth: 12,
          expiryYear: new Date().getFullYear() + 1,
          cvv: "123",
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        addToast(body.error ?? "No se pudo recargar saldo", "danger");
        return;
      }

      setNewBalance(body.newBalance ?? null);
      addToast(`Recarga de ${tokenAmount} ShopTokens completada`, "success");
    } catch {
      addToast("No se pudo recargar saldo", "danger");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center py-10">
      <div className="w-full max-w-lg space-y-6">
        <BackLink href="/student/shop" label="Volver a la tienda" />

        <Card className="space-y-6">
          {/* Título */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-text">Recargar ShopTokens</h1>
            <p className="text-sm text-text-muted mt-1">
              Entorno de simulación — no se realizan cargos reales
            </p>
          </div>

          {/* Equivalencia */}
          <div className="flex items-center justify-center gap-3 rounded-lg bg-primary/5 border border-primary/20 py-3 px-4">
            <span className="text-2xl">💶</span>
            <div className="text-center">
              <p className="text-sm text-text-muted">Tipo de cambio</p>
              <p className="text-lg font-bold text-primary">1€ = {RATE} ShopTokens</p>
            </div>
          </div>

          {/* Paquetes predefinidos */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-text">Selecciona un paquete</p>
            <div className="grid grid-cols-3 gap-3">
              {PACKAGES.map((pkg, i) => (
                <button
                  key={pkg.label}
                  type="button"
                  onClick={() => { setSelected(i); setNewBalance(null); }}
                  className={cn(
                    "relative rounded-lg border-2 p-4 text-center transition-all cursor-pointer",
                    selected === i
                      ? "border-primary bg-primary/5"
                      : "border-border-default hover:border-primary/30",
                  )}
                >
                  {pkg.bonus > 0 && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                      <Badge variant="success">+{pkg.bonus} gratis</Badge>
                    </div>
                  )}
                  <p className="text-xs text-text-muted mt-1">{pkg.label}</p>
                  <p className="text-2xl font-bold text-text">{pkg.euros}€</p>
                  <p className="text-sm font-semibold text-primary">{pkg.tokens} ShopTokens</p>
                </button>
              ))}
            </div>
          </div>

          {/* Separador */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-border-default" />
            <span className="text-xs text-text-muted">o elige tu cantidad</span>
            <div className="flex-1 border-t border-border-default" />
          </div>

          {/* Personalizado */}
          <div
            className={cn(
              "rounded-lg border-2 p-4 transition-all cursor-pointer",
              selected === "custom"
                ? "border-primary bg-primary/5"
                : "border-border-default hover:border-primary/30",
            )}
            onClick={() => { setSelected("custom"); setNewBalance(null); }}
          >
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input
                  label="Cantidad en euros"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={customEuros}
                  onChange={(e) => {
                    setCustomEuros(e.target.value);
                    setSelected("custom");
                    setNewBalance(null);
                  }}
                  placeholder="Ej: 6"
                />
              </div>
              <div className="text-center pt-5">
                <span className="text-2xl text-text-muted">=</span>
              </div>
              <div className="flex-1 text-center pt-5">
                <p className="text-2xl font-bold text-primary">
                  {selected === "custom" && tokenAmount > 0 ? tokenAmount : "—"}
                </p>
                <p className="text-xs text-text-muted">ShopTokens</p>
              </div>
            </div>
            {selected === "custom" && parseFloat(customEuros) > 0 && (
              <p className="text-xs text-text-muted mt-2 text-center">
                Sin bonus — los paquetes predefinidos incluyen tokens extra
              </p>
            )}
          </div>

          {/* Resumen y botón */}
          {tokenAmount > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-card border border-border-default p-3">
                <span className="text-sm text-text-muted">Vas a recibir</span>
                <span className="text-lg font-bold text-primary">{tokenAmount} ShopTokens</span>
              </div>

              <Button
                onClick={handleSubmit}
                loading={submitting}
                disabled={!canSubmit}
                className="w-full"
                size="lg"
              >
                Pagar {euroAmount}€ (simulado)
              </Button>
            </div>
          )}

          {/* Resultado */}
          {newBalance !== null && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-center">
              <p className="text-sm text-text-muted">Nuevo saldo disponible</p>
              <p className="text-2xl font-bold text-success">{newBalance} ShopTokens</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
