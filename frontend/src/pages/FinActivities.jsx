import Header from "../components/Header/Header";
import FinHero from "../components/FinHero/FinHero";
import FinGallery from "../components/FinGallery/FinGallery";
import Footer from "../components/Footer/Footer";
import { useEffect } from 'react'

function FinActivities() {
      useEffect(() => {
      document.title = 'Материально-техническое обеспечение'
    }, [])

  return (
    <div className="page page--fin_activities">
      <Header />
      <FinHero />
      <FinGallery />
      <Footer />
    </div>
  );
}

export default FinActivities;