import Header from "../components/Header/Header";
import Hero from "../components/Hero/Hero";
import About from "../components/About/About";
import Services from "../components/Services/Services";
import Reviews from "../components/Reviews/Reviews";
import Footer from "../components/Footer/Footer";
import { useEffect } from 'react'

function Home() {
      useEffect(() => {
      document.title = 'РАСсвет | Главная'
    }, [])
  return (
    <>
      <Header />
      <Hero />
      <About />
      <Services />
      <Reviews />
      <Footer />
    </>
  );
}

export default Home;