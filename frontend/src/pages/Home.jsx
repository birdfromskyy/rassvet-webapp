import Header from "../components/Header/Header";
import Hero from "../components/Hero/Hero";
import About from "../components/About/About";
import Services from "../components/Services/Services";
import Reviews from "../components/Reviews/Reviews";
import HomeMap from "../components/HomeMap/HomeMap";
import Footer from "../components/Footer/Footer";
import Stories from "../components/Stories/Stories";
import { useEffect } from "react";

function Home() {
  useEffect(() => {
    document.title = "Главная";
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
