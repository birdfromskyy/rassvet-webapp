import "./SocialFormHero.scss";
import socialFormImg from "../../assets/social-form-hero.png";

function SocialFormHero() {
  return (
    <section className="socialFormHero">
      <div className="container socialFormHero__inner">
        <div className="socialFormHero__content">
          <span className="socialFormHero__badge">Формы обслуживания</span>

          <h1>Форма социального обслуживания</h1>

          <p>
            Центр оказывает социальные услуги в формах обслуживания, которые
            помогают детям получать поддержку в комфортных и безопасных условиях.
          </p>
        </div>

        <img
          src={socialFormImg}
          alt=""
          className="socialFormHero__image"
        />
      </div>
    </section>
  );
}

export default SocialFormHero;