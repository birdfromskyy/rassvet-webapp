import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import { useEffect } from 'react'
import ServicesDescriptionHero from "../components/ServicesDescriptionHero/ServicesDescriptionHero";
import ServicesDescriptionList from "../components/ServicesDescriptionList/ServicesDescriptionList";

function ServicesDescription() {
      useEffect(() => {
      document.title = 'Описание услуг'
    }, [])
  return (
    <div className="page page--services_description">
      <Header />
      <main>
        <ServicesDescriptionHero />
        <ServicesDescriptionList />
      </main>
      <Footer />
    </div>
  );
}

export default ServicesDescription;