"use client";

import type { FormEvent, ReactNode } from "react";
import { REPAIR_AUTHORIZATION_PROVIDER_CERTIFICATION, REPAIR_INVOICE_PROVIDER_CERTIFICATION, type RepairLineItem } from "../../lib/maryland-repair-records";
import { formatMoney, LineItemEditor, SavedLineItems, type Translate } from "./line-items";

export type RepairRecord = Record<string, unknown> & {
  id: string; requestId: string; quoteId: string; providerId: string; scopeVersion: number;
  status: string; documentHash: string; customerSignatureAt: string; totalAmountCents: number; lineItems: RepairLineItem[];
};
export type Invoice = RepairRecord & { invoiceNumber: string; customerCopyDeliveredAt: string; providerCopyRetainedAt: string };
export type RepairJob = {
  requestId: string; requestStatus: string; vehicle: string; service: string; serviceCodes: string;
  customerName: string; customerEmail: string; serviceAddress: string; quoteId: string; quotePriceCents: string;
  scopeVersion: number; providerId: string; providerName: string; providerEmail: string; providerBusinessAddress: string;
  isTest: boolean; writesAllowed: boolean; writeBlockReason: string; authorizationWritesAllowed: boolean; invoiceWritesAllowed: boolean;
  authorization: RepairRecord | null; invoice: Invoice | null;
};
export type RepairData = {
  testOnly: boolean; realJobsEnabled: boolean; role: "customer" | "provider"; email: string; version: string;
  legalNotices: { customerRightsHeading: string; customerRightsText: string; writtenEstimateStandard: string;
    manufacturerNotice: string; responsibilityNotice: string; electronicSignatureNotice: string };
  jobs: RepairJob[];
};
export type Action = "save-authorization" | "save-invoice" | "sign-authorization" | "sign-invoice" | "receive-invoice-copy";
export type Label = [string, string];
export function text(value: unknown) { return typeof value === "string" || typeof value === "number" ? String(value) : ""; }
function when(value: unknown, spanish: boolean) {
  const date = new Date(text(value));
  return Number.isFinite(date.getTime()) ? date.toLocaleString(spanish ? "es-US" : "en-US") : "—";
}
function stringList(value: unknown) {
  try { const list: unknown = typeof value === "string" ? JSON.parse(value) : value; return Array.isArray(list) ? list.filter(item => typeof item === "string").join(", ") : ""; }
  catch { return ""; }
}
function localDateTime(value: unknown) {
  const date = new Date(text(value));
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
}
type FieldDefinition = { name: string; label: Label; max?: number; type?: string; optional?: boolean };
const contactFields: FieldDefinition[] = [
  { name: "providerBusinessName", label: ["Provider business name", "Nombre de la empresa proveedora"], max: 180 },
  { name: "providerBusinessAddress", label: ["Provider business address", "Dirección de la empresa proveedora"] },
  { name: "providerBusinessPhone", label: ["Provider business phone", "Teléfono de la empresa proveedora"], type: "tel", max: 60 },
  { name: "countyRegistrationNumber", label: ["Montgomery County registration number", "Número de registro del condado de Montgomery"], max: 120 },
  { name: "customerName", label: ["Customer name", "Nombre del cliente"], max: 180 },
  { name: "customerAddress", label: ["Customer address", "Dirección del cliente"] },
  { name: "vehicleYear", label: ["Vehicle year", "Año del vehículo"], max: 20 },
  { name: "vehicleMakeModel", label: ["Vehicle make and model", "Marca y modelo del vehículo"], max: 180 },
  { name: "vehicleTag", label: ["Vehicle tag", "Matrícula del vehículo"], max: 40 },
  { name: "vehicleVin", label: ["VIN (optional)", "VIN (opcional)"], max: 40, optional: true },
  { name: "odometerReading", label: ["Odometer reading", "Lectura del odómetro"], type: "number" },
];
const representatives: FieldDefinition[] = [
  { name: "providerRepresentativeName", label: ["Provider representative name", "Nombre del representante del proveedor"], max: 180 },
  { name: "providerRepresentativeTitle", label: ["Provider representative title", "Cargo del representante del proveedor"], max: 120 },
];
function Field({ field, value, t }: { field: FieldDefinition; value?: unknown; t: Translate }) {
  return <label>{t(...field.label)}<input name={field.name} defaultValue={text(value)} required={!field.optional}
    maxLength={field.max ?? 300} type={field.type ?? "text"}
    {...(field.type === "number" ? { min: 0, max: 10_000_000, step: 1 } : {})} /></label>;
}
function Area({ name, label, value, t, max = 2400, optional = false }: {
  name: string; label: Label; value: unknown; t: Translate; max?: number; optional?: boolean;
}) {
  return <label>{t(...label)}<textarea name={name} defaultValue={text(value)} required={!optional} rows={3} maxLength={max} /></label>;
}
const billing: Array<[string, string, string]> = [
  ["clock_hour", "Clock hour", "Hora de trabajo"], ["flat_rate_manual", "Industry flat-rate manual", "Manual de tarifas fijas del sector"],
  ["other_flat_rate", "Other disclosed flat-rate measure", "Otra medida de tarifa fija informada"],
];
const warranties: Array<[string, string, string]> = [
  ["provider_business", "Provider business express warranty", "Garantía expresa de la empresa proveedora"],
  ["manufacturer", "Manufacturer or supplier warranty", "Garantía del fabricante o distribuidor"],
  ["none_offered", "No provider express warranty offered", "No se ofrece garantía expresa del proveedor"],
];
function partsOptions(invoice: boolean): Array<[string, string, string]> {
  return [[invoice ? "returned" : "return", invoice ? "Returned to customer" : "Return replaced parts to customer", invoice ? "Devueltas al cliente" : "Devolver las piezas reemplazadas al cliente"],
    ["customer_declined", "Customer expressly declined return", "El cliente rechazó expresamente la devolución"],
    ["warranty_return", "Warranty return requirement", "Devolución exigida por la garantía"], ["not_applicable", "No replaced parts", "No hay piezas reemplazadas"]];
}
function Select({ name, label, value, options, t }: { name: string; label: Label; value: unknown; options: Array<[string, string, string]>; t: Translate }) {
  return <label>{t(...label)}<select name={name} defaultValue={text(value)} required><option value="" disabled>{t("Choose one", "Elija una opción")}</option>
    {options.map(([key, en, es]) => <option value={key} key={key}>{t(en, es)}</option>)}
  </select></label>;
}
function choice(value: unknown, options: Array<[string, string, string]>, t: Translate) {
  const match = options.find(item => item[0] === value); return match ? t(match[1], match[2]) : text(value);
}
function startingLines(job: RepairJob, invoice: boolean): RepairLineItem[] {
  return (invoice ? job.invoice?.lineItems ?? job.authorization?.lineItems : job.authorization?.lineItems) ?? [{
    lineType: "labor", description: job.service, partNumber: "", partCondition: "not_applicable", quantity: 1,
    unitAmountCents: Number(job.quotePriceCents), lineAmountCents: Number(job.quotePriceCents), laborMinutes: 0, mechanicIdentifier: "",
  }];
}
type WorkspaceProps = { job: RepairJob; data: RepairData; t: Translate; spanish: boolean; blocked: boolean;
  submit: (event: FormEvent<HTMLFormElement>, action: Action) => void };

export function RepairWorkspace({ job, data, t, spanish, blocked, submit }: WorkspaceProps) {
  const authorization = job.authorization, invoice = job.invoice;
  const copiesRecorded = Boolean(invoice?.customerSignatureAt && invoice.customerCopyDeliveredAt && invoice.providerCopyRetainedAt && invoice.customerCopyDeliveryMethod === "secure-account-copy" && text(invoice.customerCopyDeliveredTo).trim().toLowerCase() === job.customerEmail.trim().toLowerCase());
  const initial: Record<string, unknown> = { providerBusinessName: job.providerName, providerBusinessAddress: job.providerBusinessAddress,
    customerName: job.customerName, customerAddress: job.serviceAddress, vehicleMakeModel: job.vehicle, ...authorization };
  return <div className="repair-job-workspace">
    <section className="repair-workflow-summary">
      <div><span className="repair-eyebrow">{job.isTest ? t("Test job · practice records", "Trabajo de prueba · documentos de práctica") : t("Your selected job", "Su trabajo seleccionado")}</span><h2>{job.vehicle}</h2><p>{job.service}</p></div>
      <p>{t("Agreed provider amount", "Importe acordado del proveedor")}: <strong>{formatMoney(Number(job.quotePriceCents), spanish)}</strong></p>
      <ol><li><strong>{t("1. Review and authorize", "1. Revisar y autorizar")}</strong><span>{authorization?.customerSignatureAt ? t("Authorization signed", "Autorización firmada") : t("Written estimate and customer signature", "Presupuesto escrito y firma del cliente")}</span></li>
        <li><strong>{t("2. Final invoice and copies", "2. Factura final y copias")}</strong><span>{copiesRecorded ? t("Copies recorded", "Copias registradas") : t("Itemized invoice, signature and secure copy", "Factura detallada, firma y copia segura")}</span></li></ol>
      <p className="repair-separate-step">{t("Signing the final invoice records receipt of that document. Confirming job completion is a separate step. Neither action here automatically releases payment.", "Firmar la factura final registra la recepción de ese documento. Confirmar la finalización del trabajo es un paso separado. Ninguna acción aquí libera pagos automáticamente.")}</p>
      {(!job.authorizationWritesAllowed || !job.invoiceWritesAllowed) && <p className="repair-paused">{t("Some changes are unavailable for this job right now. You can still read and print your saved copies.", "Algunos cambios no están disponibles para este trabajo en este momento. Puede seguir leyendo e imprimiendo sus copias guardadas.")}</p>}
    </section>
    {data.role === "provider" && (!authorization || authorization.status === "draft") && <section className="repair-edit-section">
      <h2>{t("Prepare the written estimate", "Prepare el presupuesto escrito")}</h2>
      <p>{t("Save the agreed details as a draft. Presenting the estimate locks this version for the customer's review and signature.", "Guarde los datos acordados como borrador. Al presentar el presupuesto, esta versión queda fija para que el cliente la revise y firme.")}</p>
      <form className="repair-record-form" data-repair-form="authorization" key={`authorization:${authorization?.id ?? "new"}:${text(authorization?.updatedAt)}`} onSubmit={event => submit(event, "save-authorization")}>
        <fieldset disabled={blocked || !job.authorizationWritesAllowed}><legend>{t("Business, customer and vehicle", "Empresa, cliente y vehículo")}</legend>
          <div className="repair-record-grid">{contactFields.map(field => <Field key={field.name} field={field} value={initial[field.name]} t={t} />)}</div>
          <Area t={t} label={["Customer instructions or description of symptoms", "Instrucciones del cliente o descripción de los síntomas"]} name="customerInstructions" value={authorization?.customerInstructions} />
          <Area t={t} label={["Provider diagnosis", "Diagnóstico del proveedor"]} name="providerDiagnosis" value={authorization?.providerDiagnosis} />
          <Select t={t} label={["Labor billing method", "Método de cobro de mano de obra"]} name="laborBillingMethod" value={authorization?.laborBillingMethod} options={billing} />
          <Area t={t} label={["Complete labor billing disclosure", "Explicación completa del cobro de mano de obra"]} name="laborDisclosure" value={authorization?.laborDisclosure} max={1200} />
          <Field t={t} field={{ name: "estimatedCompletionAt", label: ["Estimated completion date/time", "Fecha y hora estimadas de finalización"], type: "datetime-local", optional: true }} value={localDateTime(authorization?.estimatedCompletionAt)} />
          <Area t={t} label={["Completion disclosure when a date cannot be determined", "Explicación cuando no se puede determinar una fecha de finalización"]} name="completionDisclosure" value={authorization?.completionDisclosure} optional max={600} />
          <p className="repair-help">{t("Enter either a completion date or an explanation above.", "Ingrese una fecha de finalización o una explicación arriba.")}</p>
          <input name="estimateFeeCents" type="hidden" value="0" /><input name="surchargeCents" type="hidden" value="0" /><input name="surchargeDescription" type="hidden" value="" />
          <Select t={t} label={["Replaced-parts handling", "Tratamiento de las piezas reemplazadas"]} name="replacedPartsChoice" value={authorization?.replacedPartsChoice ?? "not_applicable"} options={partsOptions(false)} />
          <LineItemEditor items={startingLines(job, false)} expectedTotal={Number(job.quotePriceCents)} t={t} spanish={spanish} />
          <div className="repair-record-grid">{representatives.map(field => <Field key={field.name} field={field} value={authorization?.[field.name]} t={t} />)}</div>
          <p className="repair-help">{t("The certification below keeps its original English wording.", "La certificación de abajo conserva su redacción original en inglés.")}</p>
          <label className="repair-check" lang="en"><input name="providerCertified" type="checkbox" /><span>{REPAIR_AUTHORIZATION_PROVIDER_CERTIFICATION}</span></label>
          <div className="repair-record-actions"><button className="button secondary" name="status" type="submit" value="draft">{t("Save draft", "Guardar borrador")}</button><button className="button primary" name="status" type="submit" value="presented">{t("Present for signature", "Presentar para firma")}</button></div>
        </fieldset>
      </form>
    </section>}
    {data.role === "provider" && authorization?.status === "signed" && (!invoice || invoice.status === "draft") && <section className="repair-edit-section">
      <h2>{t("Prepare the final invoice", "Prepare la factura final")}</h2>
      <p>{t("Describe the work and warranty details. The total must match the signed authorization. The final invoice can issue after the job is recorded as completed.", "Describa el trabajo y los detalles de la garantía. El total debe coincidir con la autorización firmada. Puede emitir la factura final cuando el trabajo esté registrado como completado.")}</p>
      <form className="repair-record-form" data-repair-form="invoice" key={`invoice:${invoice?.id ?? "new"}:${text(invoice?.updatedAt)}`} onSubmit={event => submit(event, "save-invoice")}>
        <fieldset disabled={blocked || !job.invoiceWritesAllowed}><legend>{t("Work, warranty and itemized labor", "Trabajo, garantía y mano de obra detallada")}</legend>
          <Area t={t} label={["All work performed, including warranty work", "Todo el trabajo realizado, incluido el trabajo de garantía"]} name="workSummary" value={invoice?.workSummary} max={3000} />
          <Area t={t} label={["Warranty work statement", "Declaración del trabajo de garantía"]} name="warrantyWorkStatement" value={invoice?.warrantyWorkStatement} max={1200} />
          <Select t={t} label={["Warranty provider", "Proveedor de la garantía"]} name="warrantyProvider" value={invoice?.warrantyProvider} options={warranties} />
          <Area t={t} label={["Specific warranty terms and limitations", "Condiciones y limitaciones específicas de la garantía"]} name="warrantyTerms" value={invoice?.warrantyTerms} max={2000} />
          <Select t={t} label={["Final replaced-parts result", "Resultado final de las piezas reemplazadas"]} name="returnedPartsChoice" value={invoice?.returnedPartsChoice ?? "not_applicable"} options={partsOptions(true)} />
          <Field t={t} field={{ name: "mechanicIdentifiers", label: ["Mechanic names, initials, or numbers (comma-separated)", "Nombres, iniciales o números de los mecánicos (separados por comas)"], max: 2000 }} value={stringList(invoice?.mechanicIdentifiers)} />
          <LineItemEditor items={startingLines(job, true)} expectedTotal={authorization.totalAmountCents} t={t} spanish={spanish} />
          <div className="repair-record-grid">{representatives.map(field => <Field key={field.name} field={field} value={invoice?.[field.name] ?? authorization[field.name]} t={t} />)}</div>
          <p className="repair-help">{t("The certification below keeps its original English wording.", "La certificación de abajo conserva su redacción original en inglés.")}</p>
          <label className="repair-check" lang="en"><input name="providerCertified" type="checkbox" /><span>{REPAIR_INVOICE_PROVIDER_CERTIFICATION}</span></label>
          <div className="repair-record-actions"><button className="button secondary" name="status" type="submit" value="draft">{t("Save invoice draft", "Guardar borrador de factura")}</button><button className="button primary" disabled={job.requestStatus.toLowerCase() !== "completed"} name="status" type="submit" value="final">{t("Issue final invoice", "Emitir factura final")}</button></div>
        </fieldset>
      </form>
    </section>}
    <SavedDocument record={authorization} invoice={false} {...{ job, data, t, spanish }}>
      {data.role === "customer" && authorization?.status === "presented" && <form className="repair-signature-form" data-repair-form="sign-authorization" key={`${authorization.id}:${authorization.documentHash}`} onSubmit={event => submit(event, "sign-authorization")}>
        <fieldset disabled={blocked || !job.authorizationWritesAllowed}><p lang="en">{data.legalNotices.electronicSignatureNotice}</p>
          <Field t={t} field={{ name: "acceptedByName", label: ["Type your full name", "Escriba su nombre completo"], max: 180 }} />
          <label className="repair-check" lang="en"><input name="signatureAccepted" required type="checkbox" /><span>I separately agree to conduct this authorization electronically and receive and retain the exact electronic record through my secure Tuveloz account. I reviewed the complete written labor estimate, Customer&apos;s Rights section, notices, itemized scope, any customer-supplied-part descriptions, labor charge, and provider identity. I authorize only this exact stored record and no parts charge.</span></label>
          <button className="button primary" type="submit">{t("Sign and authorize this exact record", "Firmar y autorizar este documento exacto")}</button>
        </fieldset>
      </form>}
    </SavedDocument>
    <SavedDocument record={invoice} invoice {...{ job, data, t, spanish }}>
      {data.role === "customer" && invoice?.status === "final" && !invoice.customerSignatureAt && <form className="repair-signature-form" data-repair-form="sign-invoice" key={`${invoice.id}:${invoice.documentHash}`} onSubmit={event => submit(event, "sign-invoice")}>
        <fieldset disabled={blocked || !job.invoiceWritesAllowed}><p lang="en">{data.legalNotices.electronicSignatureNotice}</p>
          <Field t={t} field={{ name: "acceptedByName", label: ["Type your full name", "Escriba su nombre completo"], max: 180 }} />
          <label className="repair-check" lang="en"><input name="signatureAccepted" required type="checkbox" /><span>I separately agree to conduct this invoice-signature and copy-delivery transaction electronically and receive and retain the exact electronic record through my secure Tuveloz account. I sign this exact provider invoice to record receipt. This does not waive a complaint, warranty claim, refund right, or any other non-waivable right.</span></label>
          <button className="button primary" type="submit">{t("Sign invoice and receive secure copy", "Firmar factura y recibir copia segura")}</button>
        </fieldset>
      </form>}
      {data.role === "customer" && invoice?.customerSignatureAt && !copiesRecorded && <form className="repair-signature-form" data-repair-form="receive-invoice-copy" key={`copy:${invoice.id}:${invoice.documentHash}`} onSubmit={event => submit(event, "receive-invoice-copy")}>
        <fieldset disabled={blocked || !job.invoiceWritesAllowed}><legend>{t("Confirm receipt of your saved copy", "Confirme la recepción de su copia guardada")}</legend>
          <p>{t("Your invoice is already signed. This records receipt of the displayed copy without signing again or confirming completion.", "Su factura ya está firmada. Esto registra la recepción de la copia que se muestra sin volver a firmar ni confirmar la finalización.")}</p>
          <label className="repair-check"><input name="copyReceived" type="checkbox" required /><span>{t("I received and can access this exact invoice copy in my secure account.", "Recibí y puedo consultar esta copia exacta de la factura en mi cuenta segura.")}</span></label>
          <button className="button primary" type="submit">{t("Record receipt of this copy", "Registrar la recepción de esta copia")}</button>
        </fieldset>
      </form>}
    </SavedDocument>
  </div>;
}

function SavedDocument({ record, invoice, job, data, t, spanish, children }: {
  record: RepairRecord | Invoice | null; invoice: boolean; job: RepairJob; data: RepairData; t: Translate; spanish: boolean; children: ReactNode;
}) {
  const row = (label: Label, value: unknown) => <div><dt>{t(...label)}</dt><dd>{text(value) || "—"}</dd></div>;
  const signed = Boolean(record?.customerSignatureAt);
  return <section className={`repair-print-document${invoice ? " repair-invoice-document" : " repair-authorization-document"}`}>
    <div className="repair-document-heading"><div><span className="repair-eyebrow">{t("Saved copy", "Copia guardada")}</span><h2>{invoice ? t("Final provider invoice", "Factura final del proveedor") : t("Written estimate and repair authorization", "Presupuesto escrito y autorización de reparación")}</h2></div>
      {record && <span className="repair-status">{signed ? t("Signed", "Firmado") : record.status === "draft" ? t("Draft · not ready to sign", "Borrador · no está listo para firmar") : t("Ready for customer signature", "Listo para la firma del cliente")}</span>}</div>
    {!record ? <p>{invoice ? t("The provider has not prepared an invoice yet.", "El proveedor todavía no ha preparado una factura.") : t("The provider has not prepared the written estimate yet.", "El proveedor todavía no ha preparado el presupuesto escrito.")}</p> : <>
      <dl className="repair-document-details">
        {invoice && row(["Invoice number", "Número de factura"], record.invoiceNumber)}
        {row(["Scope version", "Versión del alcance"], record.scopeVersion)}{row(["Services", "Servicios"], stringList(record.serviceCodes) || job.service)}
        {row(["Provider business", "Empresa proveedora"], record.providerBusinessName)}{row(["Provider address", "Dirección del proveedor"], record.providerBusinessAddress)}
        {row(["Provider phone", "Teléfono del proveedor"], record.providerBusinessPhone)}{row(["County registration", "Registro del condado"], record.countyRegistrationNumber)}
        {row(["Customer", "Cliente"], record.customerName)}{row(["Customer address", "Dirección del cliente"], record.customerAddress)}
        {row(["Vehicle", "Vehículo"], `${text(record.vehicleYear)} ${text(record.vehicleMakeModel)}`)}{row(["Vehicle tag", "Matrícula"], record.vehicleTag)}
        {row(["Odometer reading", "Lectura del odómetro"], record.odometerReading)}{record.vehicleVin ? row(["VIN", "VIN"], record.vehicleVin) : null}
        {row(["Customer instructions", "Instrucciones del cliente"], record.customerInstructions)}{row(["Provider diagnosis", "Diagnóstico del proveedor"], record.providerDiagnosis)}
        {row(["Labor billing method", "Método de cobro de mano de obra"], choice(record.laborBillingMethod, billing, t))}
        {row(["Labor billing disclosure", "Explicación del cobro de mano de obra"], record.laborDisclosure)}
        {!invoice && row(["Estimated completion", "Finalización estimada"], when(record.estimatedCompletionAt, spanish))}
        {!invoice && row(["Completion disclosure", "Explicación de la finalización"], record.completionDisclosure)}
        {!invoice && row(["Estimate fee", "Cargo por presupuesto"], formatMoney(record.estimateFeeCents, spanish))}
        {!invoice && row(["Surcharge / description", "Recargo / descripción"], `${formatMoney(record.surchargeCents, spanish)} ${text(record.surchargeDescription)}`)}
        {invoice && row(["Work performed", "Trabajo realizado"], record.workSummary)}{invoice && row(["Warranty work", "Trabajo de garantía"], record.warrantyWorkStatement)}
        {invoice && row(["Warranty provider", "Proveedor de la garantía"], choice(record.warrantyProvider, warranties, t))}
        {invoice && row(["Warranty terms", "Condiciones de la garantía"], record.warrantyTerms)}{invoice && row(["Mechanics", "Mecánicos"], stringList(record.mechanicIdentifiers))}
        {row(["Replaced parts", "Piezas reemplazadas"], choice(invoice ? record.returnedPartsChoice : record.replacedPartsChoice, partsOptions(invoice), t))}
        {row(["Provider representative", "Representante del proveedor"], `${text(record.providerRepresentativeName)} · ${text(record.providerRepresentativeTitle)}`)}
        {row(["Provider certification recorded", "Certificación del proveedor registrada"], when(invoice ? record.issuedAt : record.providerSignedAt, spanish))}
        {row(invoice ? ["Issued", "Emitida"] : ["Presented", "Presentado"], when(invoice ? record.issuedAt : record.presentedAt, spanish))}
      </dl>
      <SavedLineItems items={record.lineItems} t={t} spanish={spanish} />
      <dl className="repair-document-details repair-totals">
        {row(["Labor", "Mano de obra"], formatMoney(record.laborAmountCents, spanish))}{row(["Parts", "Piezas"], formatMoney(record.partsAmountCents, spanish))}
        {row(["Tax", "Impuestos"], formatMoney(record.taxAmountCents, spanish))}{row(["Other charges", "Otros cargos"], formatMoney(record.otherAmountCents, spanish))}
        {row(["Provider total", "Total del proveedor"], formatMoney(record.totalAmountCents, spanish))}
      </dl>
      <div className="repair-original-notices"><p className="repair-help">{t("The notices and signature statements below retain their original English wording. Review the complete record before signing.", "Los avisos y las declaraciones de firma de abajo conservan su redacción original en inglés. Revise el documento completo antes de firmar.")}</p>
        {record.providerCertification ? <div className="repair-legal-notice" lang="en"><p>{text(record.providerCertification)}</p></div> : null}
        <div className="repair-legal-notice" lang="en">{!invoice && <p>{text(record.writtenEstimateStandard)}</p>}<p>{text(record.manufacturerNotice)}</p><p>{text(record.responsibilityNotice)}</p></div>
      </div>
      {!invoice && <div className="repair-customer-rights" lang="en"><h3>{text(record.customerRightsHeading) || data.legalNotices.customerRightsHeading}</h3><p>{text(record.customerRightsText) || data.legalNotices.customerRightsText}</p></div>}
      {children}
      <dl className="repair-signature-status">
        {row(["Customer signer", "Firmante del cliente"], record.customerSignatureName)}
        {row(["Customer signature", "Firma del cliente"], signed ? when(record.customerSignatureAt, spanish) : t("Not recorded", "No registrada"))}
        {invoice && row(["Customer copy receipt", "Recepción de la copia del cliente"], record.customerCopyDeliveredAt ? when(record.customerCopyDeliveredAt, spanish) : t("Not recorded", "No registrada"))}
        {invoice && row(["Copy delivery method", "Método de entrega de la copia"], record.customerCopyDeliveryMethod)}
        {invoice && row(["Provider retained copy", "Copia conservada por el proveedor"], record.providerCopyRetainedAt ? when(record.providerCopyRetainedAt, spanish) : t("Not recorded", "No registrada"))}
      </dl>
      {signed && <details className="repair-saved-consent"><summary>{t("Electronic transaction notice", "Aviso de transacción electrónica")}</summary><p lang="en">{data.legalNotices.electronicSignatureNotice}</p></details>}
      {invoice && <p className="repair-help">{t("Invoice receipt is separate from job completion. No payment is released by this page.", "La recepción de la factura es independiente de la finalización del trabajo. Esta página no libera pagos.")}</p>}
      <details className="repair-record-reference"><summary>{t("Document references", "Referencias del documento")}</summary><p>{t("Record reference", "Referencia del documento")}: {record.id}</p><p>{t("Document hash", "Hash del documento")}: {record.documentHash || "—"}</p><p>{t("Document version", "Versión del documento")}: {text(record.version)}</p><p>{t("Job / quote / provider", "Trabajo / cotización / proveedor")}: {record.requestId} / {record.quoteId} / {record.providerId}</p>{invoice && <><p>{t("Authorization reference", "Referencia de autorización")}: {text(record.authorizationRecordId)}</p><p>{t("Authorization hash", "Hash de autorización")}: {text(record.authorizationDocumentHash)}</p></>}</details>
      <div className="repair-document-actions"><button className="button secondary" onClick={() => window.print()} type="button">{t("Print or save this secure copy", "Imprimir o guardar esta copia segura")}</button></div>
    </>}
  </section>;
}
