import "./RatingHero.scss";
import ratingImg from "../../assets/online-review.png";

function RatingHero() {
  return (
    <section className="ratingHero">
      <div className="page-container ratingHero__inner">
        <div className="ratingHero__content">
          <span className="section-badge">Документы</span>

          <h1>Независимая оценка качества</h1>

          <p>
            В разделе представлены документы по независимой оценке качества
            условий оказания социальных услуг Центра.
          </p>
        </div>
      </div>
    </section>
  );
}

export default RatingHero;