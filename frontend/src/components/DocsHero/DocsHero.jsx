import "./DocsHero.scss";
import docsImg from "../../assets/docs.png";

function DocsHero() {
  return (
    <section className="docs-hero">
      <div className="container docs-hero__inner">
        <div className="docs-hero__content">
          <span className="section-badge">Документы</span>

          <h1 className="docs-hero__title">
            Важная информация о работе центра
          </h1>

          <p className="docs-hero__text">
            Здесь собраны основные документы организации: сведения о социальных
            услугах, тарифах, правилах, планах и условиях работы центра.
          </p>
        </div>
      </div>

      <div className="docs-hero__bg">
        <span className="docs-circle docs-circle--yellow"></span>
        <span className="docs-circle docs-circle--blue"></span>
        <span className="docs-circle docs-circle--light"></span>
      </div>

      <div className="docs-hero__wave">
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path
            d="M0,70 C240,20 480,110 720,70 C960,30 1200,90 1440,45 L1440,120 L0,120 Z"
            fill="#dfe7ee"
          />
        </svg>
      </div>
    </section>
  );
}

export default DocsHero;