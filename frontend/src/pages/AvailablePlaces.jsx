import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";

import AvailableHero from "../components/AvailableHero/AvailableHero";
import AvailableStats from "../components/AvailableStats/AvailableStats";
import { useEffect } from 'react'

function AvailablePlaces() {
  useEffect(() => {
    document.title = 'Свободные места'
  }, [])
  return (
    <div className="page page--available_places">
      <Header />
      <main>
        <AvailableHero />
        <AvailableStats />
      </main>
      <Footer />
    </div>
  );
}

export default AvailablePlaces;