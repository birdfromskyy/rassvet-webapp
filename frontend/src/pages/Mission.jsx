import Header from "../components/Header/Header";
import MissionHero from "../components/MissionHero/MissionHero";
import MissionGoals from "../components/MissionGoals/MissionGoals";
import Footer from "../components/Footer/Footer";
import { useEffect } from 'react'
function Mission() {
      useEffect(() => {
      document.title = 'РАСсвет | Миссия и цели'
    }, [])
  return (
    <>
      <Header />
      <MissionHero />
      <MissionGoals />
      <Footer />
    </>
  );
}

export default Mission;