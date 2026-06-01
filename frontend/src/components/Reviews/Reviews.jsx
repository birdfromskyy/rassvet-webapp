import { useState, useEffect } from "react";
import "./Reviews.scss";
import userIcon from "../../assets/review-user.png";
import reviewService from "../../services/reviewService";

const PER_PAGE = 3;

function Reviews() {
  const [all, setAll] = useState([]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    reviewService.getPublishedReviews().then(setAll).catch(() => {});
  }, []);

  const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const visible = all.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const stars = (n) => "★".repeat(Math.min(5, Math.max(1, n)));

  return (
    <section className="reviews">
      <div className="reviews__wave-top">
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path
            d="M0,40 C240,100 480,0 720,40 C960,80 1200,20 1440,60 L1440,0 L0,0 Z"
            fill="#f7f4ec"
          />
        </svg>
      </div>

      <div className="container reviews__inner">
        <h2 className="reviews__title">Отзывы родителей</h2>

        {visible.length > 0 ? (
          <div className="reviews__grid">
            {visible.map((r) => (
              <article className="reviews__card" key={r.id}>
                <div className="reviews__bubble">
                  <p>{r.content}</p>
                  <span className="reviews__bubble-tail" />
                </div>

                <div className="reviews__meta">
                  <img src={userIcon} alt="" className="reviews__avatar" />
                  <div className="reviews__info">
                    <div className="reviews__author">{r.author_name}</div>
                    <div className="reviews__stars">{stars(r.rating)}</div>
                    {r.source_platform && (
                      <div className="reviews__source">{r.source_platform}</div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p style={{ color: "#55707f", textAlign: "center", marginBottom: 40 }}>
            Отзывы появятся здесь.
          </p>
        )}

        {totalPages > 1 && (
          <div className="reviews__pagination">
            <button
              className="reviews__pg-btn"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >←</button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                className={`reviews__pg-dot${i === page ? " is-active" : ""}`}
                onClick={() => setPage(i)}
                aria-label={`Страница ${i + 1}`}
              />
            ))}
            <button
              className="reviews__pg-btn"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
            >→</button>
          </div>
        )}

        <a href="/reviews" className="reviews__btn">
          Все отзывы
        </a>
      </div>
    </section>
  );
}

export default Reviews;
