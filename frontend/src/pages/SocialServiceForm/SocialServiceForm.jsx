import { useEffect, useRef } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./SocialServiceForm.scss";

/* Social service form page — "Rassvet 2.0" design (Skills/Design2.md).
   Content unchanged. */

const forms = [
  {
    title: "Социальное обслуживание на дому",
    text: "Оказание социальных услуг получателям в привычной домашней обстановке.",
  },
  {
    title: "Полустационарное социальное обслуживание",
    text: "Предоставление социальных услуг в Центре в течение определённого времени без постоянного проживания.",
  },
];

function SocialServiceForm() {
  const rootRef = useRef(null);

  useEffect(() => {
    document.title = "Форма социального обслуживания";
  }, []);

  useBrandFont();
  useReveal(rootRef);

  return (
    <div className="social-page" ref={rootRef}>
      <Header />

      <section className="d2-section d2-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner d2-hero__inner--solo">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">Формы обслуживания</span>
            <h1 className="d2-hero__title">Форма социального обслуживания</h1>
            <p className="d2-hero__text">
              Центр оказывает социальные услуги в формах обслуживания, которые
              помогают детям получать поддержку в комфортных и безопасных
              условиях.
            </p>
          </div>
        </div>
      </section>

      <section className="d2-section d2-section--auto sf-section">
        <div className="page-container">
          <div className="d2-head" data-reveal>
            <span className="d2-tag d2-tag--dark">Форматы</span>
            <h2 className="d2-h2">Доступные формы обслуживания</h2>
          </div>

          <div className="sf-grid" data-reveal>
            {forms.map((item) => (
              <article className="sf-card" key={item.title}>
                <span className="sf-card__icon" aria-hidden="true">
                  ✓
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default SocialServiceForm;
