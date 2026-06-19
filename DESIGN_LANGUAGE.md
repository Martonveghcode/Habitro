# Habitro Design Language

## 1. Direction

The product should now follow a GitHub-inspired design language, adapted for this learning tool.

The target feel is:

- minimal
- utilitarian
- dense but calm
- content-first
- border-led rather than decoration-led
- predictable in state behavior

This is not a marketing site. It is a working interface. The design should prioritize scanability, control clarity, and fast orientation over spectacle.

## 2. Product-Specific Constraints

These constraints from the current product still stand:

- one framing layer below the global nav
- one hero banner for orientation
- no section card rail below the hero
- no duplicate workspace headers inside each section
- no helper-copy clutter under controls

The GitHub-inspired system should be applied inside those constraints.

## 3. Core Principles

### Content first

Content should carry the contrast.

That means:

- the current prompt is visually primary
- control chrome stays quieter than the task content
- borders separate regions more than shadows do
- status and metadata stay compact

### Progressive disclosure

Not every concept needs a visible explanation up front.

Prefer:

- concise labels
- one visible primary action
- result detail after interaction
- optional detail panels when needed

Avoid:

- long instructional copy
- repeated “how this works” text
- layered intro sections

### Calm density

GitHub-like density does not mean cramped.

It means:

- 14px controls
- 16px primary reading text
- 12px labels and metadata
- compact but readable spacing
- short vertical travel between decision points

## 4. Color Rules

### Semantic token model

All colors should be treated semantically.

Use semantic roles like:

- `fg-default`
- `fg-muted`
- `bg-default`
- `bg-muted`
- `border-default`
- `accent-emphasis`
- `success-emphasis`
- `danger-emphasis`

Do not hard-code decorative color per component.

### Base palette

Primary reference values:

- text default: `#1f2328`
- text muted: `#59636e`
- text subtle: `#818b98`
- page background: `#ffffff`
- muted background: `#f6f8fa`
- inset background: `#eef1f4`
- border default: `#d1d9e0`
- border muted: `#d8dee4`
- emphasis surface: `#25292e`
- accent emphasis: `#25292e`
- success emphasis: `#1f883d`
- danger emphasis: `#cf222e`

### No blue ambient treatment

This is now a hard rule.

Do not use:

- blue gradients in the page background
- blue hero glows
- blue-tinted cards
- pale blue selected surfaces
- blue informational banners as default treatment

Use black or charcoal for emphasis instead.

Default surfaces should stay neutral gray/white.

### State treatment

States should be predictable:

- default: neutral border and default background
- hover: slightly darker neutral surface or border
- selected: neutral fill with stronger border or emphasis surface
- focus-visible: charcoal ring
- disabled: muted foreground and muted surface
- success: green foreground or green-muted background
- danger: red foreground or red-muted background

## 5. Typography

### Font stacks

Sans:

```css
-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"
```

Monospace:

```css
"Monaspace Neon", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace
```

### Hierarchy

The app should use a GitHub-like cadence:

- hero title: `clamp(1.75rem, 3vw, 2.5rem)`, weight 600
- hero subhead: `16px`, weight 400
- prompt title: `clamp(1.5rem, 3vw, 2rem)`, weight 600
- panel title: `20px`, weight 600
- body: `14px` default, `16px` for more important reading
- labels / kickers: `12px`, weight 600
- code: `13px` monospace

### Copy style

Copy should be:

- short
- direct
- operational
- unadorned

The product should sound like a well-designed tool, not a landing page.

## 6. Spacing and Layout

### Scale

Primary spacing rhythm:

- 4
- 8
- 12
- 16
- 24
- 32
- 48

Default usage:

- 8px for compact control gaps
- 12px for field spacing
- 16px for panel padding
- 24px for section padding and structural gaps

### Shell

The shell should remain:

1. sticky global nav
2. hero banner
3. main content stage

The app can stay centered to a practical working width, but it should feel like an application pane, not a cinematic canvas.

Recommended max width:

- around `1280px`

### Page layouts

Practice:

- left sticky control panel
- right main task surface

History and settings:

- single column
- one broad content pane

## 7. Surface Language

### Boxes over cards

The dominant surface pattern should be a GitHub-like box:

- white or muted surface
- 1px border
- 6px to 8px radius
- little or no default shadow

But this applies to major structural containers, not every nested element inside them.

Avoid card-inside-card composition.

If a section already sits inside a bordered surface, prefer:

- spacing
- typography
- simple separators

over adding another full box around its contents.

Use shadows only for:

- overlays
- floating layers if introduced later

Do not use:

- heavy elevation
- blur-backed glass panels
- decorative gradients

### Radius

Default radii:

- controls: `6px`
- panels: `8px`
- larger shell surfaces: `8px` to `12px` if needed

Do not use oversized rounded marketing shapes as the default language.

## 8. Components

### Global nav

The top nav should be:

- compact
- text-first
- lightly bordered
- muted by default

Active section state should be shown with:

- stronger text
- neutral selected surface
- border clarity

Not with a pale blue fill.

### Hero banner

The hero stays, but it should behave like a GitHub-style repository overview box rather than an Apple marketing hero.

It should contain:

- title
- page actions
- compact state metrics

It should not contain:

- gradients
- glow effects
- decorative wash color
- secondary explanatory copy
- mini-cards for each metric

### Page actions

Page actions should look like compact GitHub buttons.

Rules:

- 32px-ish height
- 6px radius
- bordered neutral default state
- darker selected state
- no large pill treatment
- no supporting subtitle text

### Buttons

Button language:

- primary: black or charcoal emphasis fill
- secondary: white / neutral with border
- danger: red-emphasis text with restrained background behavior

Default control height:

- around `32px`

### Inputs

Inputs should be understated:

- white background
- 1px border
- 6px radius
- 14px text
- charcoal focus ring

### Choice pills

Choice controls should become compact segmented-like buttons, not soft promotional chips.

Active state should be neutral and structural:

- muted gray fill
- stronger border
- darker text

Avoid blue-tinted active backgrounds.

### Status banners

Default informational banners should be neutral.

Use:

- gray border
- muted gray background
- default foreground

Reserve colored fills for:

- warnings
- destructive/error states
- explicit success confirmation if needed

### Result and detail panels

These should read as content boxes:

- neutral background
- clear border
- modest padding
- no decorative treatment

Where possible, flatten them further:

- use a top divider instead of a full border
- avoid rounded sub-cards inside larger panels

### Tables

Tables should follow GitHub-like conventions:

- muted header background
- compact cell padding
- thin borders
- strong alignment
- no decorative row effects

## 9. What This System Rejects

This design language should explicitly avoid:

- Apple-like glassmorphism
- large-radius luxury surfaces
- ambient blue page coloration
- pale blue active chips
- glowing hero sections
- oversized pill navigation
- decorative shadow stacks
- explanatory microcopy under every control

## 10. Accessibility and Interaction

The interface should keep strong GitHub-like defaults:

- visible focus ring
- clear hover states
- strong disabled styling
- semantic structure
- readable contrast

If a state exists, it should be obvious without relying only on color.

## 11. Final Standard

Any new screen or component should pass this check:

1. Does it feel like a working tool rather than a landing page?
2. Are borders and spacing doing more work than decoration?
3. Is emphasis black/charcoal rather than blue or pale blue?
4. Can the screen be scanned quickly at 14px body size?
5. Is any visible helper copy strictly necessary?

If the answer to any of those is no, it is not aligned with this design language yet.
