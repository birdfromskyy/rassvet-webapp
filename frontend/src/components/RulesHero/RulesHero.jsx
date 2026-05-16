import rulesImg from "../../assets/docs.png";
import "./RulesHero.scss";

function RulesHero() {
  return (
    <section className="rulesHero">
      <div className="container rulesHero__inner">
        <div className="rulesHero__content">
          <span className="section-badge">Документы</span>

          <h1>О правилах внутреннего распорядка</h1>

          <p>
            В данном разделе размещены документы, регулирующие порядок работы
            Центра и правила пребывания получателей социальных услуг.
          </p>
        </div>
      </div>
    </section>
  );
}

export default RulesHero;