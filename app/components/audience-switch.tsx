"use client";

import Link from "next/link";

export type Audience = "customers" | "providers";

/**
 * One visible control that says who a page is talking to. Without `onSelect`
 * it navigates (homepage ↔ the provider landing page); with `onSelect` it
 * switches the current page between its two audience modes.
 */
export function AudienceSwitch({
  active,
  onSelect,
  label = "Choose who you are",
}: {
  active: Audience;
  onSelect?: (audience: Audience) => void;
  label?: string;
}) {
  const options: Array<{ audience: Audience; text: string; href: string }> = [
    { audience: "customers", text: "For customers", href: "/" },
    { audience: "providers", text: "For providers", href: "/join" },
  ];

  return (
    <div aria-label={label} className="audience-switch" role="group">
      {options.map((option) => {
        const isActive = option.audience === active;
        if (onSelect) {
          return (
            <button
              aria-pressed={isActive}
              className={isActive ? "on" : ""}
              key={option.audience}
              onClick={() => onSelect(option.audience)}
              type="button"
            >
              {option.text}
            </button>
          );
        }
        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={isActive ? "on" : ""}
            href={option.href}
            key={option.audience}
          >
            {option.text}
          </Link>
        );
      })}
    </div>
  );
}
