import { Header } from "../components/header";
import { Hero } from "../components/hero";
import { InsightsSection } from "../components/insights-section";
import { BrandMarquee } from "../components/brand-marquee";

export function Landing() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <Header />
      <main>
        <Hero />
        <BrandMarquee />
        <InsightsSection />
        <div className="h-[20vh]" />
      </main>
    </div>
  );
}
