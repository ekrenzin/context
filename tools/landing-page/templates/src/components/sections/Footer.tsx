import { Github } from "lucide-react";
import { siteConfig } from "../../site.config";

export function Footer() {
  const { name, links } = siteConfig;

  return (
    <footer className="border-t border-[var(--border)] py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-[var(--muted-foreground)]">
          {name} {links.license ? `-- ${links.license} License` : ""}
        </p>

        <div className="flex items-center gap-6">
          <a
            href={links.docs}
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Docs
          </a>
          <a
            href={links.github}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            aria-label="GitHub"
          >
            <Github className="w-5 h-5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
