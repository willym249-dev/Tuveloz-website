# Design system

One vocabulary for how the app looks. The goal is that a new screen is
assembled from existing parts rather than styled from scratch.

## The two rules

1. **Never hard-code a colour, size or spacing value in a component.** Add it
   to `src/theme/tokens.ts` and use the generated utility class.
2. **Never build a button, card, input or text style by hand.** Use the
   primitive. If it cannot do what you need, extend the primitive.

## Tokens

`src/theme/tokens.ts` is the single source of truth. It is consumed twice:
`tailwind.config.ts` turns it into NativeWind classes, and runtime code that
cannot use classes (spinner colours, tab bar tints) imports it directly.
Because both read the same file, the two can never drift.

### Colour

Palette inherited from the Tuveloz brand, so app and website read as one
product.

| Role             | Class                | Value     | Used for                        |
| ---------------- | -------------------- | --------- | ------------------------------- |
| Background       | `bg-background`      | `#F4F7F9` | Every screen                    |
| Surface          | `bg-surface`         | `#FFFFFF` | Cards, inputs, tab bar          |
| Surface (muted)  | `bg-surface-muted`   | `#F7F9FB` | Pressed states, disabled inputs |
| Border           | `border-border`      | `#DFE6EB` | Hairlines, card edges           |
| Text             | `text-ink`           | `#071726` | Primary text                    |
| Text (secondary) | `text-ink-secondary` | `#41586E` | Supporting copy                 |
| Text (muted)     | `text-ink-muted`     | `#607083` | Captions, hints                 |
| **Primary**      | `bg-primary`         | `#1268FF` | **Customer** actions            |
| **Accent**       | `bg-accent`          | `#FF6A00` | **Provider** actions            |
| Success          | `bg-success`         | `#21A779` | Completed, accepted             |
| Warning          | `bg-warning`         | `#B54708` | Needs attention                 |
| Danger           | `bg-danger`          | `#D92D20` | Errors, destructive actions     |

Each of `primary`, `accent`, `success`, `warning` and `danger` also has a
`-soft` variant for backgrounds behind coloured text, and the two action
colours have a `-dark` variant for pressed states.

**Primary is the customer colour, accent is the provider colour.** This is the
main way the two halves of the marketplace are told apart at a glance — the
customer tab bar tints blue, the provider one orange. Keep it consistent.

### Type

`text-<variant>` carries its line height with it.

| Variant      | Size / line height | Used for                                      |
| ------------ | ------------------ | --------------------------------------------- |
| `display`    | 32 / 38            | Screen titles on landing screens, big numbers |
| `title`      | 24 / 30            | Screen titles                                 |
| `heading`    | 19 / 25            | Card titles, section headings                 |
| `subheading` | 17 / 24            | Emphasised body                               |
| `body`       | 16 / 24            | Default                                       |
| `bodySmall`  | 14 / 21            | Supporting copy                               |
| `label`      | 14 / 20            | Form labels                                   |
| `caption`    | 12 / 17            | Hints, badges, metadata                       |

Fonts are the platform system faces. There is no custom typeface yet; adding
one is an `expo-font` change plus a `fontFamily` entry in the Tailwind theme.

### Spacing and radius

Spacing is a 4pt grid (`p-4` = 16pt). Radii: `rounded-control` (12pt) for
anything tappable, `rounded-card` (16pt) for containers, `rounded-full` for
pills and avatars.

## Primitives

All exported from `@/components/ui`.

| Component                   | Purpose                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Screen`                    | Screen container: safe-area insets, background, optional scroll and keyboard avoidance               |
| `Text`                      | All text. Takes `variant` and `tone`                                                                 |
| `Button`                    | All buttons. `primary` \| `accent` \| `secondary` \| `ghost` \| `danger`, three sizes, loading state |
| `Card` / `CardHeader`       | Content container, optionally tappable                                                               |
| `TextField`                 | Labelled input with hint and error slots                                                             |
| `Badge`                     | Compact status marker                                                                                |
| `Divider`                   | Hairline rule, optionally labelled                                                                   |
| `Avatar`                    | Profile image with initials fallback                                                                 |
| `ListItem`                  | Settings/navigation row                                                                              |
| `EmptyState`                | What a list shows when empty                                                                         |
| `LoadingView` / `ErrorView` | The other two states of any async screen                                                             |

### A representative screen

```tsx
import { Button, Card, CardHeader, Screen, Text } from '@/components/ui';

export default function ExampleScreen() {
  return (
    <Screen scroll>
      <Text variant="title" className="mt-4">
        Requests
      </Text>

      <Card className="mt-6">
        <CardHeader title="Brake inspection" subtitle="Submitted 2 days ago" />
        <Button label="View quotes" />
      </Card>
    </Screen>
  );
}
```

Note what is absent: no `StyleSheet`, no hex values, no manual safe-area
handling, no font sizes.

## Conventions

- **Screens inside tabs pass `edges={['top']}`** to `Screen`. The tab bar
  already owns the bottom inset; claiming it twice leaves a visible gap.
- **Every primitive accepts `className`**, merged with `cn()` so callers can
  override defaults predictably (last class wins).
- **Tap targets are at least 48pt.** The primitives enforce this; preserve it
  in anything new.
- **Every interactive element needs an accessibility label.** `Button` derives
  one from its label; custom `Pressable`s must set it explicitly.
- **Colour is never the only signal.** Pair it with text or an icon.

## Adding a primitive

1. Create `src/components/ui/<name>.tsx`.
2. Style with utility classes only — no raw values.
3. Accept `className` and merge it last with `cn()`.
4. Export from `src/components/ui/index.ts`.
5. Add a row to the table above.
