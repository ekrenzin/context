# Section Reference

Each section is a React component in `src/components/sections/`. All read
from `siteConfig`. Composed in `App.tsx`, reorderable, removable.

---

## Hero

Top section. Sets the tone.

**Config:** `siteConfig.hero`
- `heading: string` -- main headline, 3-8 words
- `subheading: string` -- 1-2 sentences
- `cta: { label, href }` -- primary button
- `secondaryCta?: { label, href }` -- optional second button
- `image?: string` -- path to screenshot (enables two-column layout)
- `badge?: string` -- optional pill above heading ("Now in beta")

**Layout:** Centered single-column by default. Two-column (text left, image
right) when `image` is set. Heading: `text-5xl` desktop, `text-3xl` mobile.

**Animation:** Magic UI `Particles` or `MagicBeam` as background. Framer
Motion text reveal (`opacity: 0, y: 20` to `1, 0`, 0.5s). CTA fades in
0.3s after heading.

---

## Features

Showcases 3-6 capabilities.

**Config:** `siteConfig.features: Array<{ title, description, icon }>`
- `icon` is a Lucide icon name (e.g. "Zap", "Shield")
- Optional per-item: `color?: string`, `link?: string`
- `siteConfig.featuresSectionTitle?: string` overrides heading

**Layout options:**
- **Card grid** (default): 3-col desktop, 2-col tablet, 1-col mobile.
  shadcn `Card`. Use when features have equal weight.
- **Bento grid**: Magic UI `BentoGrid`, first item spans 2 columns.
  Use when 4-6 features have varying importance.

**Animation:** Stagger reveal via Framer Motion `whileInView` with
`once: true`. Each card: `initial={{ opacity: 0, y: 30 }}`, 0.1s delay.

---

## HowItWorks

3-step (2-4) flow showing how to use the product.

**Config:** `siteConfig.howItWorks.steps: Array<{ title, description, icon?, code? }>`

**Layout:** Horizontal on desktop (side by side, dashed connecting lines),
vertical timeline on mobile. Step numbers in styled circles.

**Animation:** Steps reveal sequentially on scroll. Connecting line draws
via CSS or Framer Motion `pathLength`. 0.2s stagger.

**Customization:** `code` field renders a syntax-highlighted block beside
the step. Connecting visual: solid, dashed (default), or arrow.

---

## Install

Tabbed install commands with copy-to-clipboard.

**Config:** `siteConfig.install`
- `heading?: string` -- default "Get Started"
- `tabs: Array<{ label, command }>` -- one tab per method
- `followUp?: string` -- follow-up command shown below tabs
- `docsLink?: string` -- link to full docs

**Layout:** Centered shadcn `Tabs`. Monospace code block with copy button
(checkmark feedback on click). Single tab auto-hides the tab bar.

**Animation:** None by default. Optional fade-in on scroll.

---

## Testimonials

Optional social proof. Skipped if `siteConfig.testimonials` is undefined.

**Config:** `siteConfig.testimonials?: Array<{ quote, author, role?, avatar? }>`

**Layout:** Magic UI `Marquee` -- horizontal infinite scroll. Two opposite
rows for 6+ quotes, single row for fewer. Static vertical stack on mobile.

**Animation:** Slow marquee (40-60s per cycle), pause on hover. No avatar
shows initials in a colored circle.

---

## Footer

**Config:** `siteConfig.links: { github?, docs?, twitter?, discord?, ... }`
and `siteConfig.footer?: { copyright?, sections?: Array<{ title, links }> }`

**Layout:**
- **Simple** (no `sections`): project name left, link icons right.
- **Multi-column** (with `sections`): 2-4 columns of categorized links.
- Copyright line at the bottom in both.

**Animation:** None. Social links render as icon buttons.
