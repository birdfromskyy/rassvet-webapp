import "./Hero.scss";

import heroPhoto from "../../assets/photo1.png";
import iconHeart from "../../assets/charity.png";
import iconChat from "../../assets/professionalism.png";
import iconFamily from "../../assets/family-room.png";
import { useRef } from "react";

export default function Hero() {
  const videoRef = useRef(null);
  return (
    <section className="hero">
      <div className="container hero__inner">
        <div className="hero__content">
          <div className="section-badge">Мы рядом. Мы помогаем</div>

          <h1 className="hero__title">
            Маленькими
            <br />
            шагами к
            <br />
            большим
            <br />
            возможностям
          </h1>

          <p className="hero__text">
            Помогаем детям с задержками развития раскрывать потенциал и
            достигать уверенности в каждом шаге.
          </p>

          <div className="hero__features">
            <div className="hero__feature">
              <img src={iconHeart} alt="" />
              <span>Индивидуальный подход</span>
            </div>

            <div className="hero__feature">
              <img src={iconChat} alt="" />
              <span>Опытные специалисты</span>
            </div>

            <div className="hero__feature">
              <img src={iconFamily} alt="" />
              <span>Поддержка семьи</span>
            </div>
          </div>

          <div className="hero__actions">
            <a href="#" className="hero__btn hero__btn--primary">
              Записаться на консультацию
            </a>

            <a href="#" className="hero__btn hero__btn--secondary">
              Узнать больше
            </a>
          </div>
        </div>

        <div className="hero__visual">
          <div className="hero__visual-decor hero__visual-decor--circle"></div>
          <div className="hero__visual-decor hero__visual-decor--circle-small"></div>
          <div className="hero__visual-decor hero__visual-decor--dots"></div>

          <div className="hero__photo-bg"></div>

          <div className="hero__photo-frame">
            <div className="hero__video-card">
              <iframe
                src="https://vk.com/video_ext.php?oid=-228149734&id=456239094&hash=1a7c1dffa23542b1"
                title="Видеовизитка Центра"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
              />
              <div className="hero__video-info">
                <span>Видеовизитка Центра</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
