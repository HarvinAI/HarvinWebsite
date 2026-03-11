import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Platform from '@/components/Platform';

export default function PlatformPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-300">
      <Navbar />
      <div className="pt-[64px]">
        <Platform />
      </div>
      <Footer />
    </div>
  );
}
