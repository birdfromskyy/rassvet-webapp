import Header from "../components/Header/Header";
import HistoryHero from "../components/HistoryHero/HistoryHero";
import HistoryTimeline from "../components/HistoryTimeline/HistoryTimeline";
import Footer from "../components/Footer/Footer";
import { useEffect } from 'react'

function History() {
      useEffect(() => {
      document.title = 'РАСсвет | История и достижения'
    }, [])
  return (
    <>
      <Header />
      <HistoryHero />
      <HistoryTimeline />
      <Footer />
    </>
  );
}

export default History;