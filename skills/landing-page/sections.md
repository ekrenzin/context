# Section Reference

Each section is a React component in `src/components/sections/`. All sections
read from `siteConfig` -- no props are passed directly. Sections are composed
in `App.tsx` and can be reordered or removed freely.

---

## Hero

The top section. Sets the tone for the entire page.

### Config shape

```ts
siteConfig.hero: {
  heading: string;          // main headline, 3-8 words
  subheading: string;       // supporting text, 1-2 sentences
  cta: {
    label: string;          // button text, e.g. "Get Started"
    href: string;           // link target, e.g. "#install" or external URL
  };
  secondaryCta?: {          // optional second button (e.g. "View on GitHub")
    label: string;
    href: string;
  };
  image?: string;           // optional hero image or screenshot path
}
```

### Layout

- Centered single-column by default.
- If `image` is provided, switches to two-column (text left, image right)
  on desktop, stacked on mobile.
- Heading uses `text-5xl` on desktop, `text-3xl` on mobile.

### Animation options

- **Particles background**: Magic UI `Particles` component behind the text.
  Subtle, low-count (30-50 particles). Good for developer tools.
- **Beam background**: Magic UI `MagicBeam` for a more dramatic effect.
  Use for consumer-facing products.
- **Text reveal**: Framer Motion `motion.h1` with `initial={{ opacity: 0, y: 20 }}`
  and `animate={{ opacity: 1, y: 0 }}`. Duration 0.5s.
- **CTA fade-in**: Delay CTA button animation by 0.3s after heading.

### Customization

- Background can be a gradient, solid color, or animated component.
- Badge/pill above the heading (e.g. "Now in beta") via an optional
  `badge?: string` field.
- For screenshot-heavy heroes, add a browser-frame wrapper component
  around the image.

---

## Features

Showcases 3-6 key capabilities.

### Config shape

```ts
siteConfig.features: Array<{
  title: string;            // feature name
  description: string;      // 1-2 sentence explanation
  icon: string;             // Lucide icon name, e.g. "Zap", "Shield", "Code"
}>
```

### Layout options

**Card grid** (default): 3 columns on desktop, 2 on tablet, 1 on mobile.
Each card shows icon, title, description. Uses shadcn `Card` component.

**Bento grid**: Magic UI `BentoGrid` for asymmetric layouts. Use when one
feature deserves more visual weight than others. First item spans 2 columns.

Choose bento when there are 4-6 features with varying importance. Choose
card grid when all features have equal weight.

### Animation

- Framer Motion stagger reveal: each card fades in with 0.1s delay.
- `whileInView` trigger with `once: true` (animate only on first scroll).
- Cards use `initial={{ opacity: 0, y: 30 }}` and
  `whileInView={{ opacity: 1, y: 0 }}`.

### Customization

- Icon color can match the primary theme color or use per-feature colors
  via an optional `color` field on each feature.
- Cards can include an optional `link` field to make them clickable.
- Section heading defaults to "Features" -- override via
  `siteConfig.featuresSectionTitle?: string`.

---

## HowItWorks

A 3-step (or 2-4 step) flow showing how to use the product.

### Config shape

```ts
siteConfig.howItWorks: {
  steps: Array<{
    title: string;          // step name, e.g. "Install"
    description: string;    // what happens in this step
    icon?: string;          // optional Lucide icon
    code?: string;          // optional code snippet shown alongside
  }>;
}
```

### Layout

- Vertical timeline on mobile (steps stacked with connecting line).
- Horizontal flow on desktop (steps side by side with connecting arrows
  or dashed lines between them).
- Step numbers rendered as styled circles (1, 2, 3).

### Animation

- Steps reveal sequentially as the user scrolls.
- Connecting line draws itself using CSS animation or Framer Motion
  `pathLength` on an SVG path.
- Each step fades in with a 0.2s stagger.

### Customization

- If `code` is provided on a step, render it in a syntax-highlighted
  code block beside the step description.
- Connecting visual can be a solid line, dashed line, or arrow.
  Default is dashed.
- Background can alternate (subtle gray band) to visually separate
  this section from Features above.

---

## Install

Tabbed install commands with copy-to-clipboard.

### Config shape

```ts
siteConfig.install: {
  heading?: string;         // default: "Get Started"
  tabs: Array<{
    label: string;          // tab label, e.g. "npm", "brew", "yarn"
    command: string;        // the command to display and copy
  }>;
}
```

### Layout

- Centered block with shadcn `Tabs` component.
- Command displayed in a monospace code block with a copy button.
- Copy button shows a checkmark briefly after clicking.

### Animation

- None by default. This section is functional, not decorative.
- Optional: fade-in on scroll using `whileInView`.

### Customization

- If only one install method exists, render without tabs (just the
  code block and copy button).
- Below the install command, optionally show a "Then run:" follow-up
  command via `siteConfig.install.followUp?: string`.
- Link to full docs via `siteConfig.install.docsLink?: string`,
  rendered as a text link below the command.

---

## Testimonials

Optional. Social proof via quote cards.

### Config shape

```ts
siteConfig.testimonials?: Array<{
  quote: string;            // the testimonial text
  author: string;           // person's name
  role?: string;            // title/company, e.g. "CTO at Acme"
  avatar?: string;          // path to avatar image
}>
```

### Layout

- Magic UI `Marquee` component: cards scroll horizontally in an
  infinite loop.
- Two rows scrolling in opposite directions if there are 6+ quotes.
- Single row for fewer quotes.
- On mobile, stack as a static vertical list (marquee can be
  disorienting on small screens).

### Animation

- Marquee scroll is the primary animation. Speed should be slow
  (40-60 seconds per full cycle).
- Pause on hover.

### Customization

- Card style uses shadcn `Card` with avatar, quote, and attribution.
- If no avatar is provided, show initials in a colored circle.
- This section is skipped entirely if `siteConfig.testimonials` is
  undefined or empty.

---

## Footer

Page bottom with links and branding.

### Config shape

```ts
siteConfig.links: {
  github?: string;
  docs?: string;
  twitter?: string;
  discord?: string;
  [key: string]: string;    // extensible for any link
}

siteConfig.footer?: {
  copyright?: string;       // e.g. "2026 Project Name"
  sections?: Array<{
    title: string;
    links: Array<{ label: string; href: string }>;
  }>;
}
```

### Layout

- Simple footer: single row with project name (left), link icons (right).
  Used when `siteConfig.footer.sections` is not defined.
- Multi-column footer: 2-4 columns of categorized links (Resources,
  Community, Legal). Used when `siteConfig.footer.sections` is defined.
- Copyright line at the bottom in both layouts.

### Animation

- None. Footers should be static and instantly readable.

### Customization

- Social links render as icon buttons (GitHub, Twitter/X, Discord icons).
- Add a "Built with [Project Name]" badge if desired.
- Dark background variant: set via a `dark` class on the footer
  container. Default matches the page background.
