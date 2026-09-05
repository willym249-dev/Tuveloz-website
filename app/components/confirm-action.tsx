"use client";

import { InterfaceCopy } from "./interface-copy";

type ConfirmActionProps = {
  title: string;
  message: string;
  confirmLabel: string;
  busyLabel?: string;
  busy?: boolean;
  backLabel?: string;
  confirmType?: "button" | "submit";
  confirmStyle?: "primary" | "lime";
  onConfirm?: () => void;
  onBack: () => void;
};

export function ConfirmAction({
  title,
  message,
  confirmLabel,
  busyLabel = "Saving…",
  busy = false,
  backLabel = "Go back",
  confirmType = "button",
  confirmStyle = "primary",
  onConfirm,
  onBack,
}: ConfirmActionProps) {
  return (
    <InterfaceCopy><div className="quote-confirm action-confirm important-confirm" role="group" aria-label={title}>
      <strong>{title}</strong>
      <p>{message}</p>
      <div>
        <button
          className={`button ${confirmStyle}`}
          disabled={busy}
          onClick={onConfirm}
          type={confirmType}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={onBack}
          type="button"
        >
          {backLabel}
        </button>
      </div>
    </div></InterfaceCopy>
  );
}
