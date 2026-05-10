import Header from "../components/Header/Header";
import FinHero from "../components/FinHero/FinHero";
import FinGallery from "../components/FinGallery/FinGallery";
import Footer from "../components/Footer/Footer";
import { useEffect } from 'react'

function FinActivities() {
      useEffect(() => {
      document.title = 'РАСсвет | '
    }, [])

  return (
    <>
      <Header />
      <FinHero />
      <FinGallery />
      <Footer />
    </>
  );
}

export default FinActivities;