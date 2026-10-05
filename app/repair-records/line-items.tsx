"use client";

import { useRef, useState } from "react";
import { parseRepairLineItems, type RepairLineItem } from "../../lib/maryland-repair-records";

export type Translate = (english: string, spanish: string) => string;

export function formatMoney(value: unknown, spanish = false) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? new Intl.NumberFormat(spanish ? "es-US" : "en-US", { style: "currency", currency: "USD" }).format(value / 100)
    : "—";
}

function dollarsToCents(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount <= 10_000_000 ? amount : null;
}

export function formLineItems(form: FormData): RepairLineItem[] | null {
  const count = Number(form.get("lineCount"));
  if (!Number.isSafeInteger(count) || count < 1 || count > 100) return null;
  const items = Array.from({ length: count }, (_, index) => {
    const field = (name: string) => String(form.get(`line.${index}.${name}`) ?? "").trim();
    const part = field("lineType") === "part";
    const unitAmountCents = part ? 0 : dollarsToCents(field("unitPrice"));
    const quantity = /^\d+$/.test(field("quantity")) ? Number(field("quantity")) : NaN;
    const laborMinutes = /^\d+$/.test(field("laborMinutes")) ? Number(field("laborMinutes")) : NaN;
    return { lineType: part ? "part" : "labor", description: field("description"),
      partNumber: part ? field("partNumber") : "", partCondition: part ? field("partCondition") : "not_applicable",
      quantity, unitAmountCents, lineAmountCents: unitAmountCents === null ? NaN : quantity * unitAmountCents,
      laborMinutes: part ? 0 : laborMinutes, mechanicIdentifier: field("mechanicIdentifier") };
  });
  return parseRepairLineItems(items);
}

type DraftLine = {
  key: number;
  lineType: "labor" | "part";
  description: string;
  quantity: string;
  unitPrice: string;
  laborMinutes: string;
  mechanicIdentifier: string;
  partNumber: string;
  partCondition: string;
};

function draft(item: RepairLineItem, key: number): DraftLine {
  return { key, lineType: item.lineType === "part" ? "part" : "labor", description: item.description,
    quantity: String(item.quantity), unitPrice: (item.unitAmountCents / 100).toFixed(2),
    laborMinutes: String(item.laborMinutes), mechanicIdentifier: item.mechanicIdentifier,
    partNumber: item.partNumber, partCondition: item.partCondition };
}

export function LineItemEditor({ items, expectedTotal, t, spanish }: {
  items: RepairLineItem[]; expectedTotal: number; t: Translate; spanish: boolean;
}) {
  const [lines, setLines] = useState(() => items.map(draft));
  const nextKey = useRef(items.length);
  const change = (key: number, field: keyof DraftLine, value: string) => {
    setLines(current => current.map(line => line.key === key ? { ...line, [field]: value } : line));
  };
  function add(lineType: "labor" | "part") {
    const key = nextKey.current++;
    setLines(current => [...current, draft({ lineType, description: "", partNumber: "",
      partCondition: lineType === "part" ? "new" : "not_applicable", quantity: 1,
      unitAmountCents: 0, lineAmountCents: 0, laborMinutes: 0, mechanicIdentifier: "" }, key)]);
  }
  const totals = lines.map(line => {
    const cents = line.lineType === "part" ? 0 : dollarsToCents(line.unitPrice);
    const quantity = Number(line.quantity);
    return cents !== null && /^\d+$/.test(line.quantity) && quantity >= 1 && quantity <= 10_000
      && Number.isSafeInteger(cents * quantity) && cents * quantity <= 10_000_000 ? cents * quantity : null;
  });
  const total = totals.every(value => value !== null) ? totals.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
  return <div className="repair-line-editor">
    <input name="lineCount" type="hidden" value={lines.length} />
    <p>{t("Add the agreed labor below. Customer-supplied parts may be described at $0; they are not sold through Tuveloz.", "Agregue la mano de obra acordada. Puede describir las piezas aportadas por el cliente a $0; no se venden a través de Tuveloz.")}</p>
    {lines.map((line, index) => {
      const name = (field: string) => `line.${index}.${field}`;
      const part = line.lineType === "part";
      return <fieldset className="repair-line-card" data-repair-line={line.lineType} key={line.key}>
        <legend>{part ? t("Customer-supplied part", "Pieza aportada por el cliente") : t("Labor", "Mano de obra")} {index + 1}</legend>
        <input name={name("lineType")} type="hidden" value={line.lineType} />
        <label>{t("Description", "Descripción")}<input name={name("description")} value={line.description} required maxLength={500}
          onChange={event => change(line.key, "description", event.target.value)} /></label>
        <div className="repair-record-grid">
          <label>{t("Quantity", "Cantidad")}<input name={name("quantity")} value={line.quantity} required type="number" min={1} max={10000} step={1}
            onChange={event => change(line.key, "quantity", event.target.value)} /></label>
          {!part && <label>{t("Unit price (USD)", "Precio por unidad (USD)")}<input name={name("unitPrice")} value={line.unitPrice} required inputMode="decimal" type="text" pattern="[0-9]+([.][0-9]{1,2})?"
            onChange={event => change(line.key, "unitPrice", event.target.value)} /></label>}
          {!part && <label>{t("Labor minutes", "Minutos de trabajo")}<input name={name("laborMinutes")} value={line.laborMinutes} required type="number" min={0} max={100000} step={1}
            onChange={event => change(line.key, "laborMinutes", event.target.value)} /></label>}
          {!part && <label>{t("Mechanic identifier", "Identificación del mecánico")}<input name={name("mechanicIdentifier")} value={line.mechanicIdentifier} maxLength={120}
            onChange={event => change(line.key, "mechanicIdentifier", event.target.value)} /></label>}
          {part && <label>{t("Part number", "Número de pieza")}<input name={name("partNumber")} value={line.partNumber} required maxLength={120}
            onChange={event => change(line.key, "partNumber", event.target.value)} /></label>}
          {part && <label>{t("Part condition", "Estado de la pieza")}<select name={name("partCondition")} value={line.partCondition}
            onChange={event => change(line.key, "partCondition", event.target.value)}>
            <option value="new">{t("New", "Nueva")}</option><option value="used">{t("Used", "Usada")}</option>
            <option value="rebuilt">{t("Rebuilt", "Reconstruida")}</option><option value="reconditioned">{t("Reconditioned", "Reacondicionada")}</option>
          </select></label>}
        </div>
        <div className="repair-line-footer"><strong>{t("Line total", "Total de la línea")}: {formatMoney(totals[index], spanish)}</strong>
          <button className="repair-text-button" disabled={lines.length === 1} onClick={() => setLines(current => current.filter(item => item.key !== line.key))} type="button">
            {t("Remove line", "Quitar línea")}
          </button></div>
      </fieldset>;
    })}
    <div className="repair-record-actions">
      <button className="button secondary" disabled={lines.length >= 100} onClick={() => add("labor")} type="button">{t("Add labor", "Agregar mano de obra")}</button>
      <button className="button secondary" disabled={lines.length >= 100} onClick={() => add("part")} type="button">{t("Add customer-supplied part", "Agregar pieza del cliente")}</button>
    </div>
    <div className="repair-total"><strong>{t("Provider labor total", "Total de mano de obra del proveedor")}: {formatMoney(total, spanish)}</strong>
      <span>{t("Agreed provider amount", "Importe acordado del proveedor")}: {formatMoney(expectedTotal, spanish)}</span>
      {total !== expectedTotal && <span className="form-error">{t("The itemized total must match the agreed provider amount.", "El total detallado debe coincidir con el importe acordado del proveedor.")}</span>}
    </div>
  </div>;
}

export function SavedLineItems({ items, t, spanish }: { items: RepairLineItem[]; t: Translate; spanish: boolean }) {
  return <ul className="repair-saved-lines">{items.map((item, index) => <li key={index}>
    <div><strong>{item.description}</strong><span>{item.lineType === "part" ? (item.lineAmountCents === 0 ? t("Customer-supplied part · $0", "Pieza del cliente · $0") : t("Part", "Pieza")) : item.lineType === "labor" ? t("Labor", "Mano de obra") : item.lineType === "tax" ? t("Tax", "Impuesto") : item.lineType === "sublet" ? t("Sublet work", "Trabajo subcontratado") : t("Other charge", "Otro cargo")}</span></div>
    <dl><div><dt>{t("Quantity", "Cantidad")}</dt><dd>{item.quantity}</dd></div>
      <div><dt>{t("Unit price", "Precio por unidad")}</dt><dd>{formatMoney(item.unitAmountCents, spanish)}</dd></div>
      <div><dt>{t("Line total", "Total de la línea")}</dt><dd>{formatMoney(item.lineAmountCents, spanish)}</dd></div>
      {item.partNumber && <div><dt>{t("Part number / condition", "Número / estado de la pieza")}</dt><dd>{item.partNumber} · {item.partCondition}</dd></div>}
      {item.mechanicIdentifier && <div><dt>{t("Mechanic", "Mecánico")}</dt><dd>{item.mechanicIdentifier}</dd></div>}
      {item.lineType === "labor" && <div><dt>{t("Labor minutes", "Minutos de trabajo")}</dt><dd>{item.laborMinutes}</dd></div>}
    </dl>
  </li>)}</ul>;
}
