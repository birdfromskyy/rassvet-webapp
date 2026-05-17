import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import { useEffect } from "react";
import ServicesListHero from "../components/ServicesListHero/ServicesListHero";
import ServicesList from "../components/ServicesList/ServicesList";

function ServicesListPage() {
  useEffect(() => {
    document.title = "Перечень социальных услуг";
  }, []);
  return (
    <>
      <div className="page page--services_list">
        <Header />
        <main>
          <ServicesListHero />
          <ServicesList />
        </main>
        <Footer />
      </div>
    </>
  );
}

export default ServicesListPage;
