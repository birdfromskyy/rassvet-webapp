import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import "./Awards.scss";
import { useState, useEffect } from "react";
import awardService from "../../services/awardService";
import { getUploadUrl } from "../../services/cmsService";

function Awards() {
  useEffect(() => { document.title = "Наши награды"; }, []);

  const [awards, setAwards]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    awardService.getPublic()
      .then(setAwards)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (awards.length < 2) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev === awards.length - 1 ? 0 : prev + 1));
    }, 5000);
    return () => clearInterval(interval);
  }, [awards]);

  const prev = () =>
    setActiveIndex((p) => (p === 0 ? awards.length - 1 : p - 1));
  const next = () =>
    setActiveIndex((p) => (p === awards.length - 1 ? 0 : p + 1));

  return (
    <div className="page page--awards">
      <Header />

      <main className="awards">
        <section className="awards__hero">
          <div className="container">
            <span className="section-badge">Наши награды</span>
            <h1>Достижения и благодарности Центра</h1>
            <p>
              Здесь представлены дипломы, сертификаты и благодарственные письма,
              отражающие вклад Центра «РАСсвет» в развитие помощи детям и семьям.
            </p>
          </div>
        </section>

        <section className="awards__section">
          <div className="container">
            {loading ? (
              <p style={{ textAlign: "center", color: "#94a3b8" }}>Загрузка...</p>
            ) : awards.length === 0 ? (
              <p style={{ textAlign: "center", color: "#94a3b8" }}>
                Награды скоро появятся здесь.
              </p>
            ) : (
              <>
                <div className="awards-carousel">
                  {awards.length > 1 && (
                    <button
                      className="awards-carousel__arrow awards-carousel__arrow--left"
                      onClick={prev}
                      type="button"
                      aria-label="Предыдущая награда"
                    >←</button>
                  )}

                  <div className="awards-carousel__card" key={activeIndex}>
                    <img
                      src={getUploadUrl(awards[activeIndex].image_url)}
                      alt={awards[activeIndex].title}
                    />
                    {awards[activeIndex].title && (
                      <h2>{awards[activeIndex].title}</h2>
                    )}
                  </div>

                  {awards.length > 1 && (
                    <button
                      className="awards-carousel__arrow awards-carousel__arrow--right"
                      onClick={next}
                      type="button"
                      aria-label="Следующая награда"
                    >→</button>
                  )}
                </div>

                {awards.length > 1 && (
                  <div className="awards-carousel__dots">
                    {awards.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={i === activeIndex ? "is-active" : ""}
                        onClick={() => setActiveIndex(i)}
                        aria-label={`Показать награду ${i + 1}`}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default Awards;
