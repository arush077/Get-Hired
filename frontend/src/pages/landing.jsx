import { Link } from "react-router-dom";
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
        <div className="h-[10vh]" />
      </main>
      <footer className="border-t border-neutral-800 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-neutral-400">
          <p>&copy; {new Date().getFullYear()} Get-Hired. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
