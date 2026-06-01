import Header from "../components/Header/Header";
import Hero from "../components/Hero/Hero";
import About from "../components/About/About";
import Services from "../components/Services/Services";
import Reviews from "../components/Reviews/Reviews";
import HomeMap from "../components/HomeMap/HomeMap";
import Footer from "../components/Footer/Footer";
import Stories from "../components/Stories/Stories";
import { useEffect } from "react";
import Lenis from "lenis";
function Home() {
  useEffect(() => {
    document.title = "Главная";

    const lenis = new Lenis({
      duration: 1.25,
      smoothWheel: true,
      smoothTouch: false,
      wheelMultiplier: 0.85,
      touchMultiplier: 1.2,
    });

    let frameId;

    function raf(time) {
      lenis.raf(time);
      frameId = requestAnimationFrame(raf);
    }

    frameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frameId);
      lenis.destroy();
    };
  }, []);

  return (
    <div className="page page--home">
      <Header />
      <Stories />
      <Hero />
      <About />
      <Services />
      <Reviews />
      <HomeMap />
      <Footer />
    </div>
  );
}

export default Home;