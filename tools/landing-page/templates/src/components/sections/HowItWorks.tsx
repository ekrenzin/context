import { motion } from "framer-motion";
import { siteConfig } from "../../site.config";

export function HowItWorks() {
  const { steps } = siteConfig;

  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
          How it works
        </h2>
        <p className="text-[var(--muted-foreground)] text-center mb-16 max-w-2xl mx-auto">
          Get started in three simple steps.
        </p>

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-12 md:gap-0">
          {/* Connecting line (desktop only) */}
          <div className="hidden md:block absolute top-8 left-[15%] right-[15%] h-px bg-gradient-to-r from-[var(--border)] via-[var(--primary)]/30 to-[var(--border)]" />

          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.15 }}
              className="flex-1 text-center relative z-10"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-[var(--primary)] bg-[var(--background)] text-[var(--primary)] text-xl font-bold mb-4">
                {step.number}
              </div>
              <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
              <p className="text-[var(--muted-foreground)] text-sm max-w-xs mx-auto">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
