import Header from "../components/Header/Header";
import DocsHero from "../components/DocsHero/DocsHero";
import DocsList from "../components/DocsList/DocsList";
import Footer from "../components/Footer/Footer";
import { useEffect } from 'react'

function Docs() {
      useEffect(() => {
      document.title = 'РАСсвет | Документы'
    }, [])

  return (
    <>
      <Header />
      <DocsHero />
      <DocsList />
      <Footer />
    </>
  );
}

export default Docs;