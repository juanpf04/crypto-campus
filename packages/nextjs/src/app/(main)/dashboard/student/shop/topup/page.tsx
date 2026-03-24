"use client";

import { useState } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/hooks/useToast";

export default function StudentShopTopupPage() {
  const { addToast } = useToast();
  const [cardNumber, setCardNumber] = useState("4111111111111111");
  const [expiryMonth, setExpiryMonth] = useState("12");
  const [expiryYear, setExpiryYear] = useState(String(new Date().getFullYear() + 1));
  const [cvv, setCvv] = useState("123");
  const [amount, setAmount] = useState("50");
  const [submitting, setSubmitting] = useState(false);
  const [newBalance, setNewBalance] = useState<number | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/shop/topup-simulated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardNumber,
          expiryMonth: Number(expiryMonth),
          expiryYear: Number(expiryYear),
          cvv,
          amount: Number(amount),
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        addToast(body.error ?? "No se pudo recargar saldo", "danger");
        return;
      }

      setNewBalance(body.newBalance ?? null);
      addToast("Recarga simulada completada", "success");
    } catch {
      addToast("No se pudo recargar saldo", "danger");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/student/shop" label="Volver a la tienda" />

      <Card className="max-w-xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-text">Recarga simulada</h1>
          <p className="text-sm text-text-muted mt-1">
            Entorno de simulacion. No introduzcas datos reales de tarjeta.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input label="Numero de tarjeta" value={cardNumber} onChange={(event) => setCardNumber(event.target.value)} />

          <div className="grid grid-cols-3 gap-3">
            <Input label="Mes" value={expiryMonth} onChange={(event) => setExpiryMonth(event.target.value)} />
            <Input label="Anio" value={expiryYear} onChange={(event) => setExpiryYear(event.target.value)} />
            <Input label="CVV" value={cvv} onChange={(event) => setCvv(event.target.value)} />
          </div>

          <Input label="Cantidad SHPT" value={amount} onChange={(event) => setAmount(event.target.value)} />

          <Button type="submit" loading={submitting} className="w-full">
            Simular recarga
          </Button>
        </form>

        {newBalance !== null && (
          <div className="rounded-lg border border-border-default bg-primary/5 p-3 text-sm text-text">
            Nuevo saldo disponible: <strong>{newBalance} SHPT</strong>
          </div>
        )}
      </Card>
    </div>
  );
}
