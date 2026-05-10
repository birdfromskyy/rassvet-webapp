import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import { useEffect } from 'react'
import ServicesDescriptionHero from "../components/ServicesDescriptionHero/ServicesDescriptionHero";
import ServicesDescriptionList from "../components/ServicesDescriptionList/ServicesDescriptionList";

function ServicesDescription() {
      useEffect(() => {
      document.title = 'РАСсвет | Описание услуг'
    }, [])
  return (
    <>
      <Header />
      <main>
        <ServicesDescriptionHero />
        <ServicesDescriptionList />
      </main>
      <Footer />
    </>
  );
}

export default ServicesDescription;