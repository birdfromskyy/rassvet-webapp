import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import { useEffect } from 'react'
import RulesHero from "../components/RulesHero/RulesHero";
import RulesList from "../components/RulesList/RulesList";

function InternalRules() {
      useEffect(() => {
      document.title = 'Правила внутреннего распорядка'
    }, [])
  return (
    <div className="page page--internal_rules">
      <Header />
      <main>
        <RulesHero />
        <RulesList />
      </main>
      <Footer />
    </div>
  );
}

export default InternalRules;