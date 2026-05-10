import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";

import AvailableHero from "../components/AvailableHero/AvailableHero";
import AvailableStats from "../components/AvailableStats/AvailableStats";
import { useEffect } from 'react'

function AvailablePlaces() {
  useEffect(() => {
    document.title = 'РАСсвет | Свободные места'
  }, [])
  return (
    <>
      <Header />
      <main>
        <AvailableHero />
        <AvailableStats />
      </main>
      <Footer />
    </>
  );
}

export default AvailablePlaces;