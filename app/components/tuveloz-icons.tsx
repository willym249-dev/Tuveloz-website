import type { SVGProps } from "react";

export type TuvelozIconName =
  | "battery"
  | "tire"
  | "diagnostics"
  | "tint"
  | "rain-guard"
  | "sunshade"
  | "detailing"
  | "quote"
  | "open-jobs"
  | "active-job"
  | "completed"
  | "earnings"
  | "storefront"
  | "overview"
  | "services"
  | "gallery"
  | "reviews";

type IconProps = SVGProps<SVGSVGElement> & {
  name: TuvelozIconName;
};

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "mini-mark" : "brand-mark"} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path
          className="brand-funnel"
          d="M4.5 5H19.5V6.1L14.3 10.9V13.6H9.7V10.9L4.5 6.1Z"
        />
        <path
          className="brand-fuel-drop"
          d="M12 14.9C13.6 16.7 14.4 18 14.4 19.1A2.4 2.4 0 1 1 9.6 19.1C9.6 18 10.4 16.7 12 14.9Z"
        />
      </svg>
    </span>
  );
}

export function TuvelozIcon({ name, className = "", ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={`tuveloz-icon ${className}`.trim()}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
      {...props}
    >
      {name === "battery" && (
        <>
          <path d="M6.1 7.1h11.4c1 0 1.8.8 1.8 1.8v7.3c0 1-.8 1.8-1.8 1.8H6.1c-1 0-1.8-.8-1.8-1.8V8.9c0-1 .8-1.8 1.8-1.8Z" />
          <path d="M8 4.8v2.3M15.6 4.8v2.3M13.1 9.7l-2.8 3.4h2.3l-1.8 2.8" />
          <path className="icon-accent" d="M19.3 11.2h1.4v2.7h-1.4" />
        </>
      )}
      {name === "tire" && (
        <>
          <circle cx="12" cy="12" r="7.4" />
          <circle cx="12" cy="12" r="3.4" />
          <path d="m8.1 5.7 1 2M14.9 16l1 2M5.7 15.9l2-1M16 9.1l2-1" />
          <path className="icon-accent" d="M11.2 2.8h2.1" />
        </>
      )}
      {name === "diagnostics" && (
        <>
          <path d="M5 5.2h14c1 0 1.8.8 1.8 1.8v10c0 1-.8 1.8-1.8 1.8H5c-1 0-1.8-.8-1.8-1.8V7c0-1 .8-1.8 1.8-1.8Z" />
          <path d="M5.8 12h2.4l1.5-3.1 2.4 6.2 1.7-4 1.1.9h3.3" />
          <path className="icon-accent" d="M16.8 3.2v2M7.2 3.2v2" />
        </>
      )}
      {name === "tint" && (
        <>
          <path d="M5.2 6.1h13.6l1.6 11.8H3.6L5.2 6.1Z" />
          <path d="m7.3 8.8 7.1 7.1M10.6 7.3l7.9 7.9" />
          <path className="icon-accent" d="M3.4 20.2h17.2" />
        </>
      )}
      {name === "rain-guard" && (
        <>
          <path d="M4.1 17.9h15.8l-1.7-9.7H7.1L4.1 17.9Z" />
          <path d="M7.1 8.2h11.1l1 2.1H8.1L5.9 17.9" />
          <path className="icon-accent" d="M6.3 4.1 5.5 5.5M11.1 3.4l-.8 1.4M15.9 4.1l-.8 1.4" />
        </>
      )}
      {name === "sunshade" && (
        <>
          <path d="M5.2 5.7h13.6l1.5 12.1H3.7L5.2 5.7Z" />
          <path d="M5 9h14M4.6 12.2h14.8M4.2 15.4h15.6" />
          <path className="icon-accent" d="M12 17.8v2.4M9.9 20.2h4.2" />
        </>
      )}
      {name === "detailing" && (
        <>
          <path d="M12 4.2c3.1 4 4.6 6.6 4.6 8.7a4.6 4.6 0 0 1-9.2 0C7.4 10.8 8.9 8.2 12 4.2Z" />
          <path d="M9.8 14.1c.4 1.1 1.2 1.7 2.4 1.8" />
          <path className="icon-accent" d="m18.8 3.6.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5.5-1.4Z" />
        </>
      )}
      {name === "quote" && (
        <>
          <path d="M5.1 4.6h13.8c1 0 1.8.8 1.8 1.8v8.3c0 1-.8 1.8-1.8 1.8h-7.1l-4.2 3v-3H5.1c-1 0-1.8-.8-1.8-1.8V6.4c0-1 .8-1.8 1.8-1.8Z" />
          <path d="M7.1 9.2h9.8M7.1 12.3h6.2" />
          <path className="icon-accent" d="M17.1 18.5h3.1" />
        </>
      )}
      {name === "open-jobs" && (
        <>
          <path d="M5.1 4.6h10.1c1 0 1.8.8 1.8 1.8v7.8c0 1-.8 1.8-1.8 1.8H5.1c-1 0-1.8-.8-1.8-1.8V6.4c0-1 .8-1.8 1.8-1.8Z" />
          <path d="M6.7 8.2h6.9M6.7 11.4h4.2" />
          <circle cx="17.2" cy="16.7" r="3.1" />
          <path className="icon-accent" d="m19.5 19 1.7 1.7" />
        </>
      )}
      {name === "active-job" && (
        <>
          <path d="M5.2 5.1h13.6v14H5.2z" />
          <path d="M8.1 3.5h7.8v3.2H8.1zM8.2 10.1h4.2M8.2 13.4h2.8" />
          <path className="icon-accent" d="m14 14.6 1.6 1.6 3.1-3.3" />
        </>
      )}
      {name === "completed" && (
        <>
          <circle cx="12" cy="12" r="8.2" />
          <path d="m8.2 12.2 2.4 2.5 5.4-5.6" />
          <path className="icon-accent" d="M12 1.8v2.1" />
        </>
      )}
      {name === "earnings" && (
        <>
          <path d="M4.1 18.8V13h3.2v5.8M10.4 18.8V9.5h3.2v9.3M16.7 18.8V5.1h3.2v13.7" />
          <path d="M3 18.8h18" />
          <path className="icon-accent" d="m4.4 9.3 4.2-3.1 3.6 1.5 5.6-4" />
        </>
      )}
      {name === "storefront" && (
        <>
          <path d="M4.2 9.2h15.6v10.1H4.2zM3.3 9.2l1.6-4.4h14.2l1.6 4.4" />
          <path d="M7.1 9.2c0 1.3 1 2.3 2.3 2.3s2.3-1 2.3-2.3c0 1.3 1 2.3 2.3 2.3s2.3-1 2.3-2.3" />
          <path className="icon-accent" d="M8 19.3v-4.8h4.1v4.8" />
        </>
      )}
      {name === "overview" && (
        <>
          <path d="M4.2 4.2h6.3v6.3H4.2zM13.5 4.2h6.3v3.9h-6.3zM13.5 11.1h6.3v8.7h-6.3zM4.2 13.5h6.3v6.3H4.2z" />
          <path className="icon-accent" d="M16.6 2.2v2" />
        </>
      )}
      {name === "services" && (
        <>
          <path d="m14.7 5.1 4.2 4.2-9.5 9.5H5.2v-4.2z" />
          <path d="m12.9 6.9 4.2 4.2M4.2 19.8h15.6" />
          <path className="icon-accent" d="m16.4 3.4 4.2 4.2" />
        </>
      )}
      {name === "gallery" && (
        <>
          <path d="M4 5.1h16v13.8H4z" />
          <circle cx="9" cy="9.5" r="1.5" />
          <path d="m5.8 17 4.1-4 2.4 2.3 2.1-2 3.8 3.7" />
          <path className="icon-accent" d="M7.1 2.9h9.8" />
        </>
      )}
      {name === "reviews" && (
        <>
          <path d="M5.2 4.4h13.6c1 0 1.8.8 1.8 1.8v8.5c0 1-.8 1.8-1.8 1.8H11l-4.2 3v-3H5.2c-1 0-1.8-.8-1.8-1.8V6.2c0-1 .8-1.8 1.8-1.8Z" />
          <path d="m12 7.1 1.1 2.2 2.4.3-1.7 1.7.4 2.4-2.2-1.1-2.2 1.1.4-2.4-1.7-1.7 2.4-.3z" />
          <path className="icon-accent" d="M17.3 18.7h3.2" />
        </>
      )}
    </svg>
  );
}
