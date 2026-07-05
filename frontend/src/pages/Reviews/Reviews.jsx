import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import reviewService from "../../services/reviewService";
import ReviewCard from "../../components/ReviewCard/ReviewCard";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./Reviews.scss";

/* Reviews page — "Rassvet 2.0" design (Skills/Design2.md).
   Same data & behaviour: published reviews + "write review" action. */

const PER_PAGE = 4;

const Reviews = ({ user }) => {
  const rootRef = useRef(null);
  const gridRef = useRef(null);
  const navigate = useNavigate();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(reviews.length / PER_PAGE));
  const pageReviews = reviews.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const goToPage = (p) => {
    const next = Math.min(pageCount, Math.max(1, p));
    if (next === page) return;
    setPage(next);
    // keep the reader anchored to the top of the reviews grid so a
    // shorter page doesn't leave them staring at the footer wave
    const top = gridRef.current
      ? gridRef.current.getBoundingClientRect().top + window.scrollY - 120
      : 0;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  useEffect(() => {
    document.title = "РАСсвет | Отзывы";
  }, []);

  useBrandFont();

  useEffect(() => {
    reviewService
      .getPublishedReviews()
      .then((data) => setReviews(data || []))
      .catch((err) => {
        setError("Ошибка загрузки отзывов");
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  useReveal(rootRef, [reviews.length, loading, page]);

  return (
    <div className="reviews-page" ref={rootRef}>
      <Header />

      <section className="d2-section d2-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner d2-hero__inner--solo">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">Отзывы</span>
            <h1 className="d2-hero__title">
              Отзывы родителей и клиентов центра
            </h1>
            <p className="d2-hero__text">
              Здесь собраны отзывы о работе специалистов и услугах центра
              «РАСсвет».
            </p>
            {user && user.role !== "teacher" ? (
              <div className="rv-hero-actions">
                <button
                  type="button"
                  className="d2-btn d2-btn--yellow"
                  onClick={() => navigate("/create-review")}
                >
                  Написать отзыв
                </button>
              </div>
            ) : !user ? (
              <div className="rv-hero-actions">
                <button
                  type="button"
                  className="d2-btn d2-btn--yellow"
                  onClick={() => navigate("/login")}
                >
                  Войти, чтобы оставить отзыв
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="d2-section d2-section--auto rv-section">
        <div className="page-container">
          <div className="d2-head" data-reveal>
            <span className="d2-tag d2-tag--dark">Мнения</span>
            <h2 className="d2-h2">Что говорят о нас</h2>
          </div>

          {loading ? (
            <p className="d2-empty">Загрузка отзывов...</p>
          ) : error ? (
            <p className="d2-empty">{error}</p>
          ) : reviews.length === 0 ? (
            <p className="d2-empty">
              Пока нет отзывов. Будьте первым, кто оставит отзыв.
            </p>
          ) : (
            <>
              <div className="rv-grid" ref={gridRef}>
                {pageReviews.map((review) => (
                  <div className="rv-cell" key={review.id} data-reveal>
                    <ReviewCard review={review} />
                  </div>
                ))}
              </div>

              {pageCount > 1 && (
                <nav className="rv-pagination" aria-label="Страницы отзывов">
                  <button
                    type="button"
                    className="rv-pagination__arrow"
                    onClick={() => goToPage(page - 1)}
                    disabled={page === 1}
                    aria-label="Предыдущая страница"
                  >
                    ←
                  </button>
                  {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                    <button
                      type="button"
                      key={p}
                      className={
                        "rv-pagination__num" +
                        (p === page ? " rv-pagination__num--active" : "")
                      }
                      onClick={() => goToPage(p)}
                      aria-current={p === page ? "page" : undefined}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="rv-pagination__arrow"
                    onClick={() => goToPage(page + 1)}
                    disabled={page === pageCount}
                    aria-label="Следующая страница"
                  >
                    →
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Reviews;
