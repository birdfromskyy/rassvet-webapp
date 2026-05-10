import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import { useEffect } from 'react'
import RulesHero from "../components/RulesHero/RulesHero";
import RulesList from "../components/RulesList/RulesList";

function InternalRules() {
      useEffect(() => {
      document.title = 'РАСсвет | Правила внутреннего распорядка'
    }, [])
  return (
    <>
      <Header />
      <main>
        <RulesHero />
        <RulesList />
      </main>
      <Footer />
    </>
  );
}

export default InternalRules;