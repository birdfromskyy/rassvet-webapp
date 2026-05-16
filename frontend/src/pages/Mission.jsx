import Header from "../components/Header/Header";
import MissionHero from "../components/MissionHero/MissionHero";
import MissionGoals from "../components/MissionGoals/MissionGoals";
import Footer from "../components/Footer/Footer";
import { useEffect } from 'react'

function Mission() {
      useEffect(() => {
      document.title = 'Миссия и цели'
    }, [])
  return (
    <div className="page page--mission">
      <Header />
      <MissionHero />
      <MissionGoals />
      <Footer />
    </div>
  );
}

export default Mission;