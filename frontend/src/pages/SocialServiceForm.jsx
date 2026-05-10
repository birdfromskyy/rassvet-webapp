import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import { useEffect } from 'react'
import SocialFormHero from "../components/SocialFormHero/SocialFormHero";
import SocialFormList from "../components/SocialFormList/SocialFormList";

function SocialServiceForm() {
      useEffect(() => {
      document.title = 'РАСсвет | Форма социального обслуживания'
    }, [])
  return (
    <>
      <Header />
      <main>
        <SocialFormHero />
        <SocialFormList />
      </main>
      <Footer />
    </>
  );
}

export default SocialServiceForm;