import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import "./Awards.scss";
import { useState, useEffect } from "react";


const awards = [
  {
    title: "Диплом победителя грантового конкурса",
    image: "https://placehold.co/600x850?text=Диплом+1",
  },
  {
    title: "Благодарственное письмо",
    image: "https://placehold.co/600x850?text=Награда+2",
  },
  {
    title: "Сертификат участника",
    image: "https://placehold.co/600x850?text=Награда+3",
  },
];

function Awards() {
      useEffect(() => {
      document.title = 'Наши награды'
    }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev === awards.length - 1 ? 0 : prev + 1));
    }, 5000);

    return () => clearInterval(interval);
  }, []);
  const [activeIndex, setActiveIndex] = useState(0);

  const prevSlide = () => {
    setActiveIndex((prev) => (prev === 0 ? awards.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setActiveIndex((prev) => (prev === awards.length - 1 ? 0 : prev + 1));
  };

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
              отражающие вклад Центра «РАСсвет» в развитие помощи детям и
              семьям.
            </p>
          </div>
        </section>

        <section className="awards__section">
          <div className="container">
            <div className="awards-carousel">
              <button
                className="awards-carousel__arrow awards-carousel__arrow--left"
                onClick={prevSlide}
                type="button"
                aria-label="Предыдущая награда"
              >
                ←
              </button>

              <div className="awards-carousel__card" key={activeIndex}>
                <img
                  src={awards[activeIndex].image}
                  alt={awards[activeIndex].title}
                />

                <h2>{awards[activeIndex].title}</h2>
              </div>

              <button
                className="awards-carousel__arrow awards-carousel__arrow--right"
                onClick={nextSlide}
                type="button"
                aria-label="Следующая награда"
              >
                →
              </button>
            </div>

            <div className="awards-carousel__dots">
              {awards.map((award, index) => (
                <button
                  key={award.title}
                  type="button"
                  className={index === activeIndex ? "is-active" : ""}
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Показать награду ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default Awards;
