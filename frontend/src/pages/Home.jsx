import Header from "../components/Header/Header";
import Hero from "../components/Hero/Hero";
import About from "../components/About/About";
import Services from "../components/Services/Services";
import HowItWorks from "../components/HowItWorks/HowItWorks";
import Reviews from "../components/Reviews/Reviews";
import Footer from "../components/Footer/Footer";
import { useEffect } from 'react'

function Home() {
      useEffect(() => {
      document.title = 'Главная'
    }, [])
  return (
    <div className="page page--home">
      <Header />
      <Hero />
      <About />
      <Services />
      <HowItWorks />
      <Reviews />
      <Footer />
    </div>
  );
}

export default Home;