export function LegalHelp({ label, text }: { label: string; text: string }) {
  return (
    <details className="legal-help">
      <summary aria-label={label}>?</summary>
      <span>{text}</span>
    </details>
  );
}
