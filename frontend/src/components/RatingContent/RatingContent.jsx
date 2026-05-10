import "./RatingContent.scss";

const docs = [
  "План график мероприятий в рамках НОК на 2025 год",
  "Перечень поставщиков социальных услуг ХМАО-Югры для проведения НОК (на 2025г.)",
  "Приказ Депсоцразвития ХМАО-Югры от 12.03.2025г. №211-р",
  "Рейтинг поставщиков социальных услуг (НОК 2025г.)",
  "Рекомендации по повышению деятельности поставщиков социальных услуг (данные представлены из отчёта оператора - НОК 2025г.)",
  "Презентация организации-оператора (результаты НОК 2025г.)",
  "План по устранению недостатков, выявленных в ходе НОК 2025г.",
];

function RatingContent() {
  return (
    <section className="rating">
      <div className="container">
        <div className="rating__grid">
          {docs.map((title, index) => (
            <article className="ratingCard" key={title}>
              <div className="ratingCard__icon">PDF</div>

              <div className="ratingCard__content">
                <span>Документ {index + 1}</span>
                <h2>{title}</h2>

                <a href="#" target="_blank" rel="noreferrer">
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

export default RatingContent;