# Spanish titles and descriptions — draft, awaiting review

- **Status:** draft — not live, not in the dictionary
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-16
- **Applies to:** the eight `/es` pages, and `lib/spanish-dictionary.ts`

Sixteen strings written by an assistant and **not reviewed by a Spanish speaker**.
Nothing here is live. The machinery that would use them shipped inert: it reads
the same exact-match dictionary as the page body, and these are not in it, so
every `/es` page still serves its English title and description today.

To make one live, add the pair to `lib/spanish-dictionary.ts` as
`"English string": "Spanish string"`. To take it back off, remove it. Neither is
a code change.

## Why these are being asked for rather than just added

A meta description is not page copy — **it is the search result**. It is the
sentence a Spanish-speaking customer in Montgomery County reads before deciding
whether Tuveloz is worth a click, and it is the one piece of writing here that
gets seen more often than the page it describes.

Everything else about Spanish on this site says reviewed-or-English: the
per-path switch, the build-failing coverage check, the toggle hidden on pages
without reviewed translations. Adding unreviewed marketing copy straight into
Google would be the one place that rule got broken, and it would be broken where
it is most visible.

## What to check when reviewing

- **The fee line.** Providers keep 100% of what they quote; customers pay a 5%
  service fee. Nothing below should imply a deduction from provider earnings.
- **"Gratis" versus "sin costo".** Used below for the free provider signup.
- **Register/registrar for provider signup**, not *inscribirse*, which reads more
  like signing up for a class.
- **Length.** Descriptions are kept under about 155 characters so Google does not
  truncate them mid-sentence. Spanish usually runs longer than English, so a
  faithful translation of an English description often needs shortening rather
  than rendering.
- **Montgomery County** is left in English throughout, as a proper noun.

## The drafts

### `/` — homepage

| | |
| --- | --- |
| **Title (en)** | Tuveloz \| Customer Choice. Provider Freedom. |
| **Title (es)** | Tuveloz \| Opciones para clientes. Libertad para proveedores. |
| **Description (es)** | Publique lo que su vehículo necesita y compare precios reales de proveedores independientes locales en Montgomery County, MD. |

The title pair already exists in `site-language.tsx`, where the browser sets
`document.title`. Adding it to the dictionary is what makes the server emit it.

### `/join` — provider signup

| | |
| --- | --- |
| **Title (es)** | Únase como proveedor — Registro gratis \| Tuveloz |
| **Description (es)** | Solicite gratis para ofrecer servicios para vehículos en Montgomery County, MD. Usted fija sus precios y se queda con el 100% de lo que cotiza. |

### `/post-job` — customer request

| | |
| --- | --- |
| **Title (es)** | Publique lo que su vehículo necesita \| Tuveloz |
| **Description (es)** | Describa el problema una vez y reciba precios de proveedores independientes verificados en Montgomery County, MD. |

### `/how-it-works`

| | |
| --- | --- |
| **Title (es)** | Cómo funciona \| Tuveloz |
| **Description (es)** | Publique lo que necesita, compare precios de proveedores locales, y elija usted. Sin subastas y sin precios fijados por la plataforma. |

### `/about`

| | |
| --- | --- |
| **Title (es)** | Acerca de Tuveloz |
| **Description (es)** | Un mercado de servicios para vehículos en Montgomery County, MD, construido para que el cliente elija y el proveedor tenga libertad. |

### `/faq`

| | |
| --- | --- |
| **Title (es)** | Preguntas frecuentes \| Tuveloz |
| **Description (es)** | Respuestas sobre cómo funciona Tuveloz: precios, tarifas, pagos, y qué se le pide a un proveedor en Montgomery County, MD. |

### `/safety`

| | |
| --- | --- |
| **Title (es)** | Seguridad \| Tuveloz |
| **Description (es)** | Qué documentos se le exigen a cada proveedor, cómo se verifican, y qué hace Tuveloz cuando algo sale mal. |

### `/ai` — Tuveloz AI

| | |
| --- | --- |
| **Title (es)** | Tuveloz AI \| Respuestas sobre su vehículo |
| **Description (es)** | Pregunte sobre el problema de su vehículo y reciba una explicación clara antes de solicitar un servicio. |

## What is not drafted here

`og:title`, `og:description`, and the Twitter pair. The rewriter translates them
through the same dictionary, so on most pages they resolve from the same strings
above once those are added. Where a page sets a different social title, it needs
its own entry and is not guessed at here.
