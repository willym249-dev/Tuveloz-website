import { cloneElement, isValidElement, type ReactNode } from "react";
import { translatedValue } from "./spanish-interface-text";
import { spanishPathFor } from "./spanish-routes";

/** Only reviewed interface copy. Values submitted by forms are never translated. */
export function translateInterfaceValue(source: string, placeholder = false): string {
  return translatedValue(source, placeholder ? "placeholder" : undefined);
}

export function spanishInterfaceHref(href: string): string {
  // Relative public paths only: account, legal, API and external links stay put.
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const match = href.match(/^([^?#]*)([\s\S]*)$/)!;
  const path = spanishPathFor(match[1]);
  return path ? `${path}${match[2]}` : href;
}

/**
 * Translate a component's rendered elements before React renders or hydrates.
 * This creates no extra DOM and preserves keys, refs, handlers and form values.
 * Child components render normally and use their own InterfaceCopy boundary.
 */
export function spanishInterfaceTree(node: ReactNode): ReactNode {
  if (typeof node === "string") return translateInterfaceValue(node);
  if (Array.isArray(node)) return node.map(spanishInterfaceTree);
  if (!isValidElement<Record<string, unknown>>(node)) return node;
  const { props, type } = node;
  if (["script", "style", "noscript"].includes(type as string)
    || ["data-language-control", "data-no-interface-translation", "data-manual-language"]
      .some((attribute) => props[attribute] !== undefined)) return node;

  const translated: Record<string, unknown> = {};
  for (const attribute of ["placeholder", "title", "aria-label"]) {
    if (typeof props[attribute] === "string") {
      translated[attribute] = translateInterfaceValue(props[attribute], attribute === "placeholder");
    }
  }
  if (typeof props.href === "string") translated.href = spanishInterfaceHref(props.href);
  if (props.children !== undefined && type !== "textarea") {
    translated.children = spanishInterfaceTree(props.children as ReactNode);
    // An option with no explicit value submits its text. Keep the original
    // value when translating its label, so selecting it retains its meaning.
    if (type === "option" && props.value === undefined && typeof props.children === "string") {
      translated.value = props.children;
    }
  }
  if ("children" in translated) {
    const children = translated.children as ReactNode;
    delete translated.children;
    // Preserve static sibling identities without inventing new keys when the
    // visitor changes language. React validates these as separate children.
    return Array.isArray(children)
      ? cloneElement(node, translated, ...children)
      : cloneElement(node, translated, children);
  }
  return cloneElement(node, translated);
}
