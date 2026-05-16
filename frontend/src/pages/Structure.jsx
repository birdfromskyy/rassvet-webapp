import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import StructureBlock from "../components/StructureBlock/StructureBlock";
import { useEffect } from 'react'

function Structure() {
      useEffect(() => {
      document.title = 'Структура организации'
    }, [])
  return (
    <div className="page page--structure">
      <Header />
      <main>
        <StructureBlock />
      </main>
      <Footer />
    </div>
  );
}

export default Structure;