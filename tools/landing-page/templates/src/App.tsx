import { Hero } from "./components/sections/Hero";
import { Features } from "./components/sections/Features";
import { HowItWorks } from "./components/sections/HowItWorks";
import { Install } from "./components/sections/Install";
import { Footer } from "./components/sections/Footer";

export function App() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Hero />
      <Features />
      <HowItWorks />
      <Install />
      <Footer />
    </div>
  );
}
