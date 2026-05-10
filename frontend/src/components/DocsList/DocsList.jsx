import "./DocsList.scss";

const documents = [
  "Объем предоставляемых социальных услуг в организации",
  "Резюме организации",
  "Свидетельство о государственной регистрации",
  "Порядок и условия предоставления социальных услуг",
  "Тарифы на социальные услуги",
  "Приказ об утверждении тарифов на предоставление услуг на коммерческой основе",
  "Численность получателей социальных услуг в организации",
  "Правила внутреннего трудового распорядка",
  "Правила внутреннего распорядка для получателей социальных услуг",
  "План финансово-хозяйственной деятельности на 2025 г.",
  "План финансово-хозяйственной деятельности на 2026–2027 гг.",
  "Положение об информационной открытости",
  "Положение об официальном сайте",
  "Сводная ведомость результатов специальной оценки условий труда",
  "Перечень рекомендуемых мероприятий по улучшению условий труда",
];

function DocsList() {
  return (
    <section className="docs-list">
      <div className="container docs-list__inner">
        <div className="docs-list__heading">
          <span className="docs-list__subtitle">Открытая информация</span>
          <h2 className="docs-list__title">Документы центра</h2>
        </div>

        <div className="docs-list__grid">
          {documents.map((document, index) => (
            <a href="#" className="docs-card" key={index}>
              <div className="docs-card__icon">PDF</div>

              <div className="docs-card__content">
                <h3>{document}</h3>
                <p>Открыть документ</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export default DocsList;