import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import StructureBlock from "../components/StructureBlock/StructureBlock";
import { useEffect } from 'react'

function Structure() {
      useEffect(() => {
      document.title = 'РАСсвет | Структура организации'
    }, [])
  return (
    <>
      <Header />
      <main>
        <StructureBlock />
      </main>
      <Footer />
    </>
  );
}

export default Structure;