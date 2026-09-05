import { spanishText, spanishPlaceholders } from "./spanish-dictionary";

function translatedPattern(value: string) {
  let match = value.match(/^(\d+) completed-job (review|reviews)$/);
  if (match) return `${match[1]} ${match[2] === "review" ? "reseña" : "reseñas"} de trabajos completados`;
  match = value.match(/^(\d+) currently listed (service|services)$/);
  if (match) return `${match[1]} ${match[2] === "service" ? "servicio actualmente publicado" : "servicios actualmente publicados"}`;
  match = value.match(/^(\d+) currently listed vehicle services$/);
  if (match) return `${match[1]} servicios para vehículos actualmente publicados`;
  match = value.match(/^At least (\d+) characters$/);
  if (match) return `Al menos ${match[1]} caracteres`;
  match = value.match(/^(\d+) characters or fewer$/);
  if (match) return `${match[1]} caracteres o menos`;
  match = value.match(/^Use at least (\d+) characters\.$/);
  if (match) return `Use al menos ${match[1]} caracteres.`;
  match = value.match(/^Use no more than (\d+) characters\.$/);
  if (match) return `Use no más de ${match[1]} caracteres.`;
  match = value.match(/^· policy version (.+)$/);
  if (match) return `· versión de la política ${match[1]}`;
  return value;
}

export function translatedValue(source: string, attribute?: "placeholder" | "title" | "aria-label") {
  const match = source.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) return source;
  const [, before, core, after] = match;
  const dictionary = attribute === "placeholder" ? spanishPlaceholders : spanishText;
  return `${before}${dictionary[core] ?? spanishText[core] ?? translatedPattern(core)}${after}`;
}

