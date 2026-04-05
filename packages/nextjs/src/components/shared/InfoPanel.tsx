"use client";

/**
 * InfoPanel — Panel informativo con las normas de funcionamiento del campus.
 * Molécula que compone Modal + contenido estático organizado por secciones.
 * Se abre desde el botón de info del Sidebar.
 */

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { icons } from "@/components/ui/icons";

interface InfoPanelProps {
  open: boolean;
  onClose: () => void;
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h3 className="font-semibold text-text">{title}</h3>
      </div>
      <div className="text-sm text-text-muted space-y-1.5 pl-7">
        {children}
      </div>
    </div>
  );
}

export function InfoPanel({ open, onClose }: InfoPanelProps) {
  return (
    <Modal open={open} onClose={onClose} title="Normas de funcionamiento">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">

        <Section icon={icons.library} title="Biblioteca">
          <p>Puedes pedir prestados <strong>libros, juegos de mesa y videojuegos</strong>.</p>
          <p>Cada préstamo requiere <strong>1 LibraryToken</strong> como depósito. Al devolver el ítem a tiempo, recuperas el token.</p>
          <p>Tienes <strong>21 días</strong> para devolver el ítem desde la aprobación del préstamo.</p>
          <p>Si no devuelves a tiempo, el bibliotecario puede forzar la devolución y <strong>pierdes el token</strong> como penalización.</p>
          <p>Al registrarte recibes <strong>10 LibraryTokens</strong> iniciales.</p>
        </Section>

        <Section icon={icons.rooms} title="Salas de estudio">
          <p>Puedes reservar salas de estudio de la biblioteca de forma <strong>gratuita</strong>.</p>
          <p>Máximo <strong>4 horas consecutivas</strong> por reserva.</p>
          <p>Límite de <strong>1 sala por día</strong> por estudiante.</p>
          <p>Puedes cancelar tu reserva en cualquier momento.</p>
        </Section>

        <Section icon={icons.shop} title="Tienda">
          <p>Compras productos del campus con <strong>ShopTokens</strong>.</p>
          <p>Al registrarte recibes <strong>100 ShopTokens</strong> iniciales.</p>
          <p>Puedes recargar tokens desde tu panel con la simulación de tarjeta.</p>
          <p>Las devoluciones son posibles dentro de los <strong>30 días</strong> siguientes a la entrega.</p>
        </Section>

        <Section icon={icons.print} title="Impresión">
          <p>Cada estudiante recibe <strong>200 créditos</strong> de impresión al registrarse.</p>
          <p><strong>1 crédito = 1 cara impresa</strong> en blanco y negro, tamaño A4.</p>
          <p>Imprimir a <strong>color</strong> cuesta el doble de créditos.</p>
          <p>La impresión a <strong>doble cara</strong> reduce el consumo de papel pero no los créditos.</p>
          <p>Puedes elegir entre varios tamaños: A4, A3 y carta.</p>
        </Section>

        <Section icon={icons.badge} title="Insignias">
          <p>Los profesores crean <strong>tareas</strong> vinculadas a insignias (badges).</p>
          <p>Al completar una tarea, recibes insignias que son <strong>NFTs no transferibles</strong> (soulbound).</p>
          <p>Puedes canjear insignias por <strong>recompensas</strong> creadas por los profesores.</p>
        </Section>
      </div>
    </Modal>
  );
}
