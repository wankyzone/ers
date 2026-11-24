import Navbar from "./components/navbar";
import Hero from "./components/hero";
import Categories from "./components/categories";
import HowItWorks from "./components/how-it-works";
import Solution from "./components/solution";
import Trust from "./components/trust";
import CTA from "./components/cta";
import Footer from "./components/footer";

export default function Page() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#080d0a] text-white">
      <Navbar />
      <Hero />
      <HowItWorks />
      <Categories />
      <Solution />
      <Trust />
      <CTA />
      <Footer />
    </main>
  );
}