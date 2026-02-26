import Navbar     from '@/components/Navbar';
import Hero       from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import TheData    from '@/components/TheData';
import Pricing    from '@/components/Pricing';
import CTA        from '@/components/CTA';
import Footer     from '@/components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <Navbar />
      <div className="pt-[64px]">
        <Hero />
        <HowItWorks />
        <TheData />
        <Pricing />
        <CTA />
      </div>
      <Footer />
    </div>
  );
}
