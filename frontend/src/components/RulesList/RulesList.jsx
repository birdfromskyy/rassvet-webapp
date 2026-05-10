import "./RulesList.scss";

const rules = [
  {
    title: "Правила внутреннего распорядка для получателей социальных услуг",
    text: "Документ содержит порядок пребывания, права и обязанности получателей социальных услуг.",
    link: "#",
  },
  {
    title: "Правила внутреннего трудового распорядка",
    text: "Документ регулирует режим труда, права и обязанности сотрудников Центра.",
    link: "#",
  },
];

function RulesList() {
  return (
    <section className="rules">
      <div className="container">

        <div className="rules__grid">
          {rules.map((item) => (
            <article className="rulesCard" key={item.title}>

              <div className="rulesCard__icon">
                PDF
              </div>

              <div className="rulesCard__content">
                <h2>{item.title}</h2>
                <p>{item.text}</p>

                <a href={item.link}>
                  Открыть документ →
                </a>
              </div>

            </article>
          ))}
        </div>

      </div>
    </section>
  );
}

export default RulesList;