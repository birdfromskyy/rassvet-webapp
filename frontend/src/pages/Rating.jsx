import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import { useEffect } from 'react'
import RatingHero from "../components/RatingHero/RatingHero";
import RatingContent from "../components/RatingContent/RatingContent";

function Rating() {
      useEffect(() => {
      document.title = 'Независимая оцена качества'
    }, [])
  return (
    <div className="page page--rating">
      <Header />
      <main>
        <RatingHero />
        <RatingContent />
      </main>
      <Footer />
    </div>
  );
}

export default Rating;