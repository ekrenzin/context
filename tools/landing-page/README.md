# Landing Page Scaffolding Tool

Template files for generating a Vite + React + Tailwind landing page.

## Usage

Copy the `templates/` directory into your target project:

```bash
cp -r tools/landing-page/templates/ site/
cd site
npm install
npm run dev
```

## Customization

Edit `src/site.config.ts` to change all project-specific content: name,
tagline, features, install commands, links, and theme colors.

Components live in `src/components/` and are fully owned -- modify freely.

## Stack

- Vite (build tool)
- React 18 (UI)
- Tailwind CSS v4 (styling)
- Framer Motion (animations)
- Lucide React (icons)
- clsx + tailwind-merge (class utilities)

## Build

```bash
npm run build    # outputs to dist/
npm run preview  # preview production build locally
```
