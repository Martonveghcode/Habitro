

## 1. Direction

This product should feel Apple-inspired, but more reduced than a typical Apple marketing page.

The reference qualities are:

- premium
- spacious
- typography-led
- calm
- image-light but still cinematic through layout and surface treatment
- highly restrained in color
- clear in hierarchy

The product is not a homepage with many modules. It is a focused learning tool. That changes the design language in an important way:

- one framing layer is enough
- one primary task surface should dominate
- secondary explanatory chrome should be removed

The UI should feel considered, not decorated.

## 2. Non-Negotiable Rules

### One framing layer only

The top of the app has two structural layers:

1. sticky global navigation
2. one hero banner

Nothing else should compete with those.

That means:

- no section grid under the hero
- no extra workspace header inside each section
- no repeated page-introduction blocks once the hero already establishes context

The hero is the single high-level orientation surface.

### No gray helper-copy clutter

Small gray description text should not be used as a default pattern.

Remove or avoid:

- helper sentences under labels
- small descriptive text under page actions
- gray “how to use this” blurbs
- explanatory footnotes under major surfaces
- “current mix” microcopy when the state is already visible elsewhere
- empty-state subtitle filler

Allowed exceptions:

- actual exercise explanations after an answer is checked
- explicit error text
- correction text in recheck flows
- concise status messaging when an async action needs it

If text does not help a decision or explain a result, it should probably not exist.

### One clear task per area

Each screen area should present one job:

- hero: orient the user
- left control panel: configure the session
- main practice panel: complete the current task
- history: review outcomes
- settings: change durable preferences

Do not mix orientation, explanation, and interaction in the same visual block unless necessary.

## 3. Experience Model

### Overall shell

The shell should follow this sequence:

1. sticky global nav
2. hero banner with section and page state
3. main content stage

The main content stage changes by page:

- practice: split view with sticky controls and one large task surface
- history: single-column analysis surface
- settings: single-column configuration surface

### Navigation behavior

Navigation should stay shallow:

- top nav changes section
- hero actions change page within the active section

This keeps the information architecture legible and avoids sidebars competing with the hero.

## 4. Visual Principles

### Typography first

Typography should do most of the hierarchy work.

Use:

- large headlines
- short subheads
- compact uppercase labels
- normal-weight body copy

Avoid:

- stacked layers of sublabels
- dense paragraph blocks
- repeated explanatory text under controls

Recommended hierarchy:

- Hero title: `clamp(2.8rem, 6vw, 4.8rem)`, weight 600, line-height near 1.02
- Hero subhead: `clamp(1.25rem, 2.2vw, 1.85rem)`, weight 400, line-height near 1.2
- Prompt title: `clamp(2rem, 4.2vw, 3.6rem)`, weight 600
- Panel titles: around `1.65rem` to `2rem`
- Labels / kickers: `0.72rem`, uppercase, wide tracking
- Body: around `0.95rem` to `1rem`

Font stack:

```css
"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif
```

Mono stack:

```css
"SF Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace
```

### Color discipline

Color should stay mostly neutral.

Primary palette:

- text primary: `#1d1d1f`
- text secondary: `#6e6e73`
- text tertiary: `#86868b`
- page background: `#ffffff`
- section background: `#f5f5f7`
- soft card background: `#fbfbfd`
- accent blue: `#0071e3`
- accent blue hover: `#0077ed`
- accent blue dark: `#2997ff`
- dark surface: `#000000`
- dark elevated surface: `#1d1d1f`

Rules:

- black, white, and gray do most of the work
- blue is for action and emphasis, not decoration
- red appears only for destructive or incorrect states
- green appears only for success states

### Surface behavior

The interface should feel layered through material and spacing, not through many borders or shadows.

Use:

- large radii
- subtle borders
- soft blur-backed surfaces
- gentle gradients
- minimal but present shadows

Avoid:

- hard card stacks everywhere
- heavy outlines
- high-contrast separators
- loud glow effects

## 5. Layout System

### Global structure

- max app width: `1440px`
- outer padding: generous on desktop, compressed on mobile
- hero and major panels use large radii
- practice layout is 2-column on desktop and 1-column on smaller widths

### Practice layout

Desktop:

- left: sticky control panel
- right: large practice panel

The right panel is the star. The left panel supports it.

The control panel should feel like a secondary surface, not the primary experience.

### History and settings

These pages should use a single-column layout.

They are not dashboards made of many little cards. They are broad, readable management views.

## 6. Component Language

### Global nav

Use a compact sticky bar with blur and a translucent white material.

The nav should contain:

- brand
- section switching
- concise system state

The nav should stay visually quiet.

### Hero banner

The hero is the only page-introduction block in the app.

It should contain:

- section eyebrow
- large title
- one short subhead
- page-switch actions
- compact current-state metrics

It should not contain:

- long explanations
- secondary footnotes
- another row of cards below it

One hero is enough.

### Page actions

Page actions should be large pill-like surfaces with strong active state.

Use:

- 3 clear actions max
- short labels only
- no mini descriptions under each action

### Panels

Panels should be soft, rounded, lightly elevated surfaces.

Use panels for:

- controls
- practice area
- history sections
- settings sections

Do not create panels just to hold explanatory copy.

### Choice pills

Choice pills should be rounded, quiet by default, and clearly active when selected.

They should communicate state through:

- subtle border change
- subtle blue tint
- clearer text color

Not through loud fills or oversized effects.

### Primary buttons

Primary buttons should be blue, pill-shaped, and singular in emphasis.

Rules:

- usually only one strong primary action should be visible per area
- secondary actions should be ghost buttons
- destructive actions should use soft red treatment, not oversized danger blocks

### Status banners

Status banners are allowed, but they must stay short.

Good:

- “Lote servido por Gemini.”
- “Modo local activado.”
- “Preparando lote...”

Bad:

- instructional paragraphs
- repeated implementation detail
- verbose fallback explanations

### Tables

Tables should be clean, scrollable, and calm.

Use:

- sticky headers
- subtle borders
- uppercase micro-labels in headers
- generous cell padding

Avoid turning tables into heavily styled admin grids.

## 7. Copy Rules

### Preferred copy style

Copy should be:

- short
- direct
- structural
- confident

### Labels

Form labels should usually stand alone.

Do not add help text unless the user cannot reasonably understand the control without it.

### Empty states

Empty states should be one short line when possible.

Good:

- “Genera una frase para empezar.”
- “Genera una palabra para empezar.”

Bad:

- extra reassurance
- tool fallback descriptions
- setup instructions embedded in the empty state

### Explanation text

Explanation text belongs after evaluation, not before interaction.

That means:

- keep explanatory content in result areas
- avoid previewing theory before the user acts

### Settings text

Settings should be label-led, not paragraph-led.

Prefer:

- field label
- input
- save action

Only add extra copy when compatibility or constraints genuinely need to be stated.

## 8. Motion

Motion should be soft and sparse.

Allowed:

- subtle rise-in on major surfaces
- small lift on hover
- quick state transitions on pills and buttons

Avoid:

- bouncing
- exaggerated parallax
- constant micro-animation
- attention-seeking transitions

## 9. Responsive Behavior

On smaller screens:

- nav wraps cleanly
- hero collapses to one column
- hero actions stack
- practice layout becomes one column
- sticky control behavior turns off

The mobile version should feel like a compacted version of the desktop experience, not a different product.

## 10. Implementation Notes

The current CSS architecture should remain token-led and component-scoped.

Prefer:

- semantic tokens in `:root`
- section-level classes
- a small set of modifiers

Avoid:

- utility-first looking markup
- extra wrappers only for styling
- duplicating orientation copy in multiple places

## 11. What This Design Language Rejects

This system should explicitly avoid:

- dashboard density
- stacked intro blocks
- repeated page headers
- section-card rails under the hero
- floating explanatory notes everywhere
- gray helper text under every control
- too many borders
- too much shadow
- more than one dominant focal area on screen

## 12. Final Standard

If a new screen or component is added, it should pass this test:

1. Is there only one main framing layer below the nav?
2. Is the primary action obvious within two seconds?
3. Did typography and spacing create hierarchy without extra explanation?
4. Can any gray helper text be deleted without losing meaning?
5. Does the screen feel calm, premium, and reduced?

If the answer to any of those is no, the screen is not aligned with this design language yet.
