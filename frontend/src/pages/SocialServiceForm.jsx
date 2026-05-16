import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import { useEffect } from 'react'
import SocialFormHero from "../components/SocialFormHero/SocialFormHero";
import SocialFormList from "../components/SocialFormList/SocialFormList";

function SocialServiceForm() {
      useEffect(() => {
      document.title = 'Форма социального обслуживания'
    }, [])
  return (
    <div className="page page--social_service_form">
      <Header />
      <main>
        <SocialFormHero />
        <SocialFormList />
      </main>
      <Footer />
    </div>
  );
}

export default SocialServiceForm;