# 0003. NativeWind over design tokens for styling

**Status:** Accepted
**Date:** 2026-08-05

## Context

NativeWind was specified. The open questions were which major version to use,
and how to stop a utility-class codebase from turning into scattered magic
values.

## Decision

**NativeWind 4.2.6 with Tailwind 3.4**, not the NativeWind 5 preview. Despite
the version numbers, 4.2.6 is the more recently maintained line (released June
2026, after the latest v5 preview) and it is the stable one. Revisit when v5
reaches a stable release.

**Tokens are the source of truth, classes are the interface.**
`src/theme/tokens.ts` defines every colour, radius, spacing step and type
style. `tailwind.config.ts` imports that file and generates the utility classes
from it. Runtime code that cannot use classes — spinner colours, tab bar tints,
navigation background — imports the same tokens directly.

Consequences enforced in review:

- No hex values, font sizes or pixel measurements inside components.
- Semantic names, not colour names: `bg-primary`, not `bg-blue`. A rebrand is
  an edit to one file.
- Every primitive accepts `className`, merged last through `cn()`
  (clsx + tailwind-merge) so overrides resolve predictably.

## Consequences

- The class list and the runtime theme cannot drift, because they are generated
  from the same file.
- Styling is co-located with markup, which makes screens readable end to end
  and removes the `styles.container` indirection.
- Class strings are not type-checked. A typo like `bg-primry` silently renders
  nothing. The mitigation is that screens compose primitives rather than
  writing many classes; Prettier's Tailwind plugin also sorts and normalises
  them.
- NativeWind adds a Babel preset and a Metro transform. If the bundler
  misbehaves after an upgrade, that pipeline is the first place to look.
- Verified: `npx expo export` produces a bundle containing both the class names
  and the compiled brand palette, so the pipeline demonstrably works.

## Alternatives considered

**StyleSheet with a theme object.** Zero build-time machinery and fully typed,
but far more verbose, and it separates styles from the markup they describe.

**A styled-components-style library.** Typed and composable, but adds runtime
overhead per component and a second styling vocabulary alongside the Tailwind
one already used on the website.
