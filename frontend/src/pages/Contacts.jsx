import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import { useEffect } from 'react'
import ContactsHero from "../components/ContactsHero/ContactsHero";
import ContactsInfo from "../components/ContactsInfo/ContactsInfo";

function Contacts() {
    useEffect(() => {
    document.title = 'РАСсвет | Контакты'
  }, [])

  return (
    <>
      <Header />
      <main>
        <ContactsHero />
        <ContactsInfo />
      </main>
      <Footer />
    </>
  );
}

export default Contacts;