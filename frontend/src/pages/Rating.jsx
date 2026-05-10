import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import { useEffect } from 'react'
import RatingHero from "../components/RatingHero/RatingHero";
import RatingContent from "../components/RatingContent/RatingContent";

function Rating() {
      useEffect(() => {
      document.title = 'РАСсвет | Независимая оцена качества'
    }, [])
  return (
    <>
      <Header />
      <main>
        <RatingHero />
        <RatingContent />
      </main>
      <Footer />
    </>
  );
}

export default Rating;