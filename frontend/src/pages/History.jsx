import Header from "../components/Header/Header";
import HistoryHero from "../components/HistoryHero/HistoryHero";
import HistoryTimeline from "../components/HistoryTimeline/HistoryTimeline";
import Footer from "../components/Footer/Footer";
import { useEffect } from 'react'

function History() {
      useEffect(() => {
      document.title = 'История и достижения'
    }, [])
  return (
    <div className="page page--history">
      <Header />
      <HistoryHero />
      <HistoryTimeline />
      <Footer />
    </div>
  );
}

export default History;