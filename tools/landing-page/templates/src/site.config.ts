import type { LucideIcon } from "lucide-react";
import {
  Zap,
  Brain,
  Shield,
  Layout,
  Monitor,
  Radio,
} from "lucide-react";

// -- Types ------------------------------------------------------------------

export interface Feature {
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface Step {
  number: number;
  title: string;
  description: string;
}

export interface InstallTab {
  label: string;
  command: string;
}

export interface SiteConfig {
  name: string;
  tagline: string;
  description: string;
  url: string;

  hero: {
    heading: string;
    subheading: string;
    cta: { label: string; href: string };
  };

  features: Feature[];
  steps: Step[];

  install: {
    tabs: InstallTab[];
  };

  links: {
    github: string;
    docs: string;
    license?: string;
  };
}

// -- Config -----------------------------------------------------------------

export const siteConfig: SiteConfig = {
  name: "My Project",
  tagline: "A short tagline for your project",
  description: "A longer description of what the project does.",
  url: "https://example.com",

  hero: {
    heading: "Build something amazing",
    subheading:
      "A compelling subtitle that explains the core value proposition.",
    cta: { label: "Get Started", href: "#install" },
  },

  features: [
    {
      title: "Feature One",
      description: "Description of the first feature.",
      icon: Zap,
    },
    {
      title: "Feature Two",
      description: "Description of the second feature.",
      icon: Brain,
    },
    {
      title: "Feature Three",
      description: "Description of the third feature.",
      icon: Shield,
    },
    {
      title: "Feature Four",
      description: "Description of the fourth feature.",
      icon: Layout,
    },
    {
      title: "Feature Five",
      description: "Description of the fifth feature.",
      icon: Monitor,
    },
    {
      title: "Feature Six",
      description: "Description of the sixth feature.",
      icon: Radio,
    },
  ],

  steps: [
    {
      number: 1,
      title: "Install",
      description: "Get up and running in seconds.",
    },
    {
      number: 2,
      title: "Configure",
      description: "Point it at your project.",
    },
    {
      number: 3,
      title: "Ship",
      description: "Deploy with a single command.",
    },
  ],

  install: {
    tabs: [
      { label: "npm", command: "npm install -g my-project" },
      { label: "brew", command: "brew install my-project" },
    ],
  },

  links: {
    github: "https://github.com/example/project",
    docs: "/docs",
    license: "MIT",
  },
};
