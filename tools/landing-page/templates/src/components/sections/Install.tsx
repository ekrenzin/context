import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { siteConfig } from "../../site.config";
import { Tabs } from "../ui/Tabs";

function CopyBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex items-center gap-3 bg-[var(--muted)] rounded-lg px-4 py-3 font-mono text-sm">
      <code className="flex-1 text-[var(--foreground)]">{command}</code>
      <button
        onClick={handleCopy}
        className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
        aria-label="Copy to clipboard"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

export function Install() {
  const { install } = siteConfig;

  const tabs = install.tabs.map((tab) => ({
    label: tab.label,
    content: <CopyBlock command={tab.command} />,
  }));

  return (
    <section id="install" className="py-24 px-6">
      <div className="max-w-xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">Install</h2>
        <p className="text-[var(--muted-foreground)] mb-10">
          Get up and running in seconds.
        </p>
        <Tabs tabs={tabs} />
      </div>
    </section>
  );
}
