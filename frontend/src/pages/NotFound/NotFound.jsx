import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./NotFound.scss";

/* 404 page — "Rassvet 2.0" design (Skills/Design2.md).
   Rendered by the catch-all route in App.js for any unknown path. */

const NotFound = () => {
  const rootRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "РАСсвет | Страница не найдена";
  }, []);

  useBrandFont();
  useReveal(rootRef, []);

  return (
    <div className="notfound-page" ref={rootRef}>
      <Header />

      <section className="d2-section d2-hero nf-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner d2-hero__inner--solo">
          <div className="d2-hero__content nf-content" data-reveal>
            <div className="nf-code" aria-hidden="true">
              4<span className="nf-code__zero">0</span>4
            </div>
            <span className="d2-tag">Страница не найдена</span>
            <h1 className="d2-hero__title">Кажется, здесь ничего нет</h1>
            <p className="d2-hero__text">
              Возможно, страница была перемещена или удалена, а ссылка
              устарела. Давайте вернёмся к чему-нибудь полезному.
            </p>

            <div className="nf-actions">
              <Link to="/main" className="d2-btn d2-btn--yellow">
                На главную
              </Link>
              <button
                type="button"
                className="d2-btn d2-btn--outline-light"
                onClick={() => navigate(-1)}
              >
                Вернуться назад
              </button>
            </div>

            <nav className="nf-links" aria-label="Полезные ссылки">
              <Link to="/services-list">Услуги</Link>
              <Link to="/news">Новости</Link>
              <Link to="/reviews">Отзывы</Link>
              <Link to="/consultation-request">Записаться</Link>
            </nav>
          </div>
        </div>
      </section>
    </div>
  );
};

export default NotFound;
