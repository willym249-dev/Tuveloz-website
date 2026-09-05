import type { Metadata } from "next";
import { headers } from "next/headers";
import { spanishPageMetadata } from "./spanish-page-metadata";

export async function requestPageMetadata(source: Metadata): Promise<Metadata> {
  const requestHeaders = await headers();
  if (requestHeaders.get("x-tuveloz-render-language") !== "es") return source;
  return spanishPageMetadata(source, requestHeaders.get("x-tuveloz-render-path") ?? "");
}
