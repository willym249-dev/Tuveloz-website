import { InterfaceCopy } from "./interface-copy";
export function LegalHelp({ label, text }: { label: string; text: string }) {
  return (
    <InterfaceCopy><details className="legal-help">
      <summary aria-label={label}>?</summary>
      <span>{text}</span>
    </details></InterfaceCopy>
  );
}
