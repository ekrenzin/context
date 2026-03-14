---
name: landing-page
description: Build polished landing pages for any project using Vite, React, shadcn/ui, Tailwind CSS, Magic UI, and Framer Motion. Use when the user asks to create a landing page, marketing page, product page, website, static site, or project homepage. Handles scaffolding, branding, SEO, and deployment to Cloudflare Pages.
---

# Landing Page Skill

Build a production-ready landing page for any project. The output is a static
Vite + React site deployed to Cloudflare Pages.

## 1. Information Gathering

Before writing code, collect these from the user:

**Required:**
- Project name
- Tagline (one sentence, what it does)
- 3-5 key features (title + short description each)
- Install or getting-started method (CLI command, download link, or signup URL)

**Optional (use sensible defaults if not provided):**
- Logo or icon (default: text-based logo using project name)
- Brand colors (default: neutral palette with a blue-ish primary)
- GitHub / docs / community links
- Screenshots or demo media
- Testimonials or social proof

If the user says "build a landing page for X" without details, ask for the
required items above. If you can infer them from the project's README or
existing docs, confirm your understanding before proceeding.

## 2. Stack

| Layer | Tool | Why |
|-------|------|-----|
| Build | Vite | Fast builds, static output, zero config |
| UI | React | Component composition for sections |
| Components | shadcn/ui | High-quality, ownable (copied into project) |
| Styling | Tailwind CSS | Utility-first, easy theming |
| Animation | Magic UI | Landing-page-specific components (beams, bento, marquee) |
| Animation | Framer Motion | Scroll reveals, transitions, custom effects |
| Deploy | Cloudflare Pages | Free static hosting, preview deploys |

**Do not use**: Next.js, Vercel, Astro, Gatsby, or any SSR/SSG framework.
This is a pure static SPA -- Vite handles the build and the output is plain
HTML/JS/CSS.

## 3. Content Model: `site.config.ts`

All project-specific content lives in a single file: `src/site.config.ts`.
Components import from it -- users edit content without touching components.

See [examples/site-config-example.ts](examples/site-config-example.ts) for a
fully annotated example.

Key principles:
- One source of truth for all text, links, and metadata.
- Icons referenced by name (string), resolved at render time via a Lucide
  icon map or custom SVG map.
- Theme overrides (colors, fonts) go in `tailwind.config.ts`, not in the
  site config. The site config holds content, not style.

## 4. Section Composition

A landing page is composed from section components. Each section is a
standalone React component that reads from `siteConfig`.

Default section order: Hero, Features, HowItWorks, Install, Footer.

Optional sections: Testimonials (add between Install and Footer).

See [sections.md](sections.md) for the full reference on each section's
interface, layout options, and animation choices.

### Adding or removing sections

Sections are rendered in `App.tsx` as a flat list:

```tsx
import { siteConfig } from "./site.config";

export default function App() {
  return (
    <main>
      <Hero />
      <Features />
      <HowItWorks />
      <Install />
      <Footer />
    </main>
  );
}
```

To remove a section, delete the import and JSX line. To reorder, move the
JSX. To add a custom section, create a new component following the same
pattern: read from `siteConfig`, export a default function component.

## 5. Branding

### Colors

Override the default palette in `tailwind.config.ts`:

```ts
export default {
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#6366f1", foreground: "#ffffff" },
        secondary: { DEFAULT: "#f1f5f9", foreground: "#0f172a" },
        accent: { DEFAULT: "#06b6d4", foreground: "#ffffff" },
      },
    },
  },
};
```

shadcn/ui components use CSS variables mapped to these Tailwind colors.
Update `src/globals.css` to sync the CSS variable layer if needed.

### Fonts

Add custom fonts via Google Fonts or local files. Update `index.html` with
the font link and `tailwind.config.ts` with the font family:

```ts
fontFamily: {
  sans: ["Inter", "system-ui", "sans-serif"],
  mono: ["JetBrains Mono", "monospace"],
},
```

### Logo

Place the logo in `public/logo.svg`. The Hero and Footer components
reference it. If no logo is provided, render the project name as styled text.

## 6. Animation

Use animations sparingly. They should enhance, not distract.

**Magic UI components** -- use for hero-level visual impact:
- `MagicBeam` or `Particles` as a hero background
- `BentoGrid` for feature layouts that need visual weight
- `Marquee` for testimonial scrolling

**Framer Motion** -- use for scroll-triggered reveals:
- `motion.div` with `whileInView` for section fade-ins
- Stagger children in feature cards (delay each by 0.1s)
- `useScroll` + `useTransform` for parallax effects (use rarely)

**Rules:**
- No animation on text-heavy content (install commands, footer links).
- Every animation must respect `prefers-reduced-motion`. Wrap motion
  components with a check or use Framer Motion's built-in support.
- Keep durations under 0.6s. Stagger delays under 0.15s per item.

## 7. SEO

### Meta tags

Set in `index.html`:

```html
<title>Project Name -- Tagline</title>
<meta name="description" content="One-sentence description." />
<meta property="og:title" content="Project Name" />
<meta property="og:description" content="One-sentence description." />
<meta property="og:image" content="/og-image.png" />
<meta property="og:url" content="https://yoursite.com" />
<meta name="twitter:card" content="summary_large_image" />
```

### OG Image

Place a 1200x630 PNG at `public/og-image.png`. If the user does not provide
one, generate a simple branded card with the project name and tagline using
a canvas script or suggest they create one later.

### Sitemap

For a single-page site, a minimal `public/sitemap.xml` suffices:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://yoursite.com/</loc>
  </url>
</urlset>
```

Add a `robots.txt` with `Sitemap: https://yoursite.com/sitemap.xml`.

## 8. Deployment

Deploy to Cloudflare Pages via the CLI. See the `deploy-site` skill for the
full workflow. Quick reference:

```bash
cd site && npm run deploy          # production
cd site && npm run deploy:preview  # preview URL for testing
```

Prerequisites: `npx wrangler login` (one-time, opens browser).

For local development, `npm run dev` starts the Vite dev server on
`localhost:5173`.

## 9. Project Structure

```
site/
  public/
    favicon.svg
    og-image.png
    sitemap.xml
    robots.txt
  src/
    components/
      sections/
        Hero.tsx
        Features.tsx
        HowItWorks.tsx
        Install.tsx
        Testimonials.tsx
        Footer.tsx
      ui/              -- shadcn/ui components (Button, Card, Tabs, etc.)
      magicui/         -- Magic UI components (Particles, BentoGrid, etc.)
    site.config.ts
    App.tsx
    main.tsx
    globals.css
  index.html
  tailwind.config.ts
  vite.config.ts
  package.json
```

## 10. Validation

Before presenting the landing page as complete:

1. **Build check**: `npm run build` completes without errors.
2. **Responsive check**: Use Playwright MCP to verify the page at 1280px,
   768px, and 375px widths. All sections should be readable and no
   horizontal overflow.
3. **Link check**: All CTA buttons and footer links point to valid targets.
4. **Accessibility**: Images have alt text. Color contrast meets WCAG AA.
   Animations respect `prefers-reduced-motion`.
5. **Performance**: No large unoptimized images. Fonts are preloaded.
   Total bundle under 200KB gzipped (excluding images).

## Additional Resources

- Section reference: [sections.md](sections.md)
- Example config: [examples/site-config-example.ts](examples/site-config-example.ts)
