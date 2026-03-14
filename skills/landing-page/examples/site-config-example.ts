// site.config.ts -- All project-specific content lives here.
// Components read from this config. Edit content here, not in components.

export const siteConfig = {
  // -- Core identity --------------------------------------------------

  // Project name, used in the header, footer, and meta tags.
  name: "Context",

  // One-line description of what the project does. Used as the meta
  // description and OG description.
  tagline: "AI workspaces that learn and improve",

  // Longer description for SEO. Keep under 160 characters.
  description:
    "A poly-repo coordination layer with persistent memory, " +
    "reusable skills, and an MQTT message bus for AI agents.",

  // Canonical URL of the deployed site. Used for OG tags and sitemap.
  url: "https://context.dev",

  // -- Hero section ---------------------------------------------------

  hero: {
    // Main headline. Keep to 3-8 words for impact.
    heading: "Your AI workspace, compounding",

    // Supporting text below the headline. 1-2 sentences max.
    subheading:
      "Context learns from every session. Skills sharpen, memory " +
      "persists, and your codebase gets easier to work with over time.",

    // Primary call-to-action button.
    cta: {
      label: "Get Started",
      href: "#install",
    },

    // Optional secondary button. Omit to show only the primary CTA.
    secondaryCta: {
      label: "View on GitHub",
      href: "https://github.com/context-dev/context",
    },

    // Optional hero image or screenshot. Path relative to /public.
    // Omit for a text-only hero with animated background.
    // image: "/screenshot.png",
  },

  // -- Features section -----------------------------------------------

  // Array of 3-6 features. Each gets a card in the features grid.
  // Icons are Lucide icon names -- see https://lucide.dev/icons
  features: [
    {
      title: "Skills",
      description:
        "Reusable workflows that evolve from usage. Encode best " +
        "practices once, apply them everywhere.",
      icon: "Zap",
    },
    {
      title: "Persistent Memory",
      description:
        "Decisions, patterns, and context survive across sessions. " +
        "No more re-explaining your architecture.",
      icon: "Brain",
    },
    {
      title: "Multi-Repo Coordination",
      description:
        "Work across repositories with shared rules, skills, and " +
        "a unified message bus.",
      icon: "GitFork",
    },
    {
      title: "Command Center",
      description:
        "Web UI for managing workspaces, deployments, and " +
        "integrations. No terminal required.",
      icon: "LayoutDashboard",
    },
  ],

  // Optional: override the section heading (default: "Features").
  // featuresSectionTitle: "Why Context",

  // -- How It Works section -------------------------------------------

  howItWorks: {
    steps: [
      {
        title: "Install",
        description: "One command to set up your workspace.",
        icon: "Download",
        // Optional: show a code snippet alongside the step.
        code: "npm install -g @context/cli",
      },
      {
        title: "Configure",
        description:
          "Point Context at your repos. It discovers structure, " +
          "skills, and rules automatically.",
        icon: "Settings",
      },
      {
        title: "Work",
        description:
          "Use your AI tools as usual. Context handles memory, " +
          "coordination, and quality gates in the background.",
        icon: "Rocket",
      },
    ],
  },

  // -- Install section ------------------------------------------------

  install: {
    // Optional heading override (default: "Get Started").
    heading: "Install in seconds",

    // One tab per install method. First tab is selected by default.
    tabs: [
      { label: "npm", command: "npm install -g @context/cli" },
      { label: "brew", command: "brew install context" },
      { label: "yarn", command: "yarn global add @context/cli" },
    ],

    // Optional follow-up command shown below the tabs.
    followUp: "ctx init",

    // Optional link to full documentation.
    docsLink: "https://context.dev/docs/getting-started",
  },

  // -- Testimonials section (optional) --------------------------------

  // Omit or set to an empty array to skip this section entirely.
  testimonials: [
    {
      quote:
        "Context turned our AI workflow from a novelty into " +
        "a genuine productivity multiplier.",
      author: "Jane Smith",
      role: "Engineering Lead at Acme",
      // Optional avatar image path. Omit to show initials.
      // avatar: "/avatars/jane.jpg",
    },
    {
      quote:
        "The skills system is what finally made AI assistants " +
        "useful for our team's specific patterns.",
      author: "Alex Chen",
      role: "Senior Developer",
    },
  ],

  // -- Links ----------------------------------------------------------

  // Used in the footer and anywhere link icons appear.
  links: {
    github: "https://github.com/context-dev/context",
    docs: "https://context.dev/docs",
    discord: "https://discord.gg/context",
    twitter: "https://twitter.com/contextdev",
  },

  // -- Footer (optional overrides) ------------------------------------

  footer: {
    // Copyright text. Year is typically prepended automatically.
    copyright: "2026 Context",

    // Optional multi-column link groups. Omit for a simple footer.
    sections: [
      {
        title: "Product",
        links: [
          { label: "Features", href: "#features" },
          { label: "Documentation", href: "https://context.dev/docs" },
          { label: "Pricing", href: "/pricing" },
        ],
      },
      {
        title: "Community",
        links: [
          { label: "GitHub", href: "https://github.com/context-dev/context" },
          { label: "Discord", href: "https://discord.gg/context" },
          { label: "Twitter", href: "https://twitter.com/contextdev" },
        ],
      },
    ],
  },

  // -- Theme ----------------------------------------------------------
  // Colors and fonts are configured in tailwind.config.ts, not here.
  // This config holds content only. See the SKILL.md branding section
  // for how to customize the visual theme.
};
