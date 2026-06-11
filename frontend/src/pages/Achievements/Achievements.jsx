import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import "./Achievements.scss";
import { useState, useEffect } from "react";

const stories = [
  {
    name: "Стокач Лёна",
    image: "https://placehold.co/700x500",
    text: [
      "Есть у нас один мальчик — Лёня. Ходит в наш Центр уже почти 3 года.",
      "У Лёни ауто трудотерапия. Занятия, на которых дети осваивают обычные бытовые навыки.",
      "Начинал с самого простого: с поддержки взрослого. Сейчас Лёня становится самостоятельнее и увереннее.",
    ],
  },
  {
    name: "Чормонов Арлен",
    image: "https://placehold.co/700x500",
    secondImage: "https://placehold.co/700x500",
    text: [
      "Как маленькому Арлену большой мир открылся.",
      "После занятий сенсорно-моторной интеграцией Арлен начал допускать физический контакт и стал увереннее взаимодействовать с окружающим миром.",
      "Работа продолжается, и впереди ещё много простых и сложных задач.",
    ],
  },
];

function Achievements() {
  useEffect(() => {
    document.title = "Наши успехи";
  }, []);

  return (
    <div className="page page--achievements">
      <Header />

      <main className="achievements">
        <section className="achievements__hero">
          <div className="page-container">
            <span className="section-badge">Наши успехи</span>

            <h1>Истории маленьких побед</h1>

            <p>
              Каждая история — это путь ребёнка, семьи и специалистов Центра. Мы
              радуемся даже небольшим шагам, потому что именно из них
              складываются большие возможности.
            </p>
          </div>
        </section>

        <section className="achievements__stories">
          <div className="page-container achievements__grid">
            {stories.map((story, index) => (
              <article className="achievement-card" key={story.name}>
                <div className="achievement-card__media">
                  <img src={story.image} alt={story.name} />

                  {story.secondImage && <img src={story.secondImage} alt="" />}
                </div>

                <div className="achievement-card__content">
                  <span>История успеха</span>

                  <h2>{story.name}</h2>

                  {story.text.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}

                  <strong>Маленькими шагами к большим возможностям!</strong>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default Achievements;
