import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import reviewService from "../../services/reviewService";
import ReviewCard from "../../components/ReviewCard/ReviewCard";
import "./Reviews.scss";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";

const Reviews = ({ user }) => {
  const navigate = useNavigate();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "РАСсвет | Отзывы";
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const data = await reviewService.getPublishedReviews();
      setReviews(data || []);
    } catch (error) {
      setError("Ошибка загрузки отзывов");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="reviews-page">
        <div className="page-container">
          <div className="reviews-page__state">
            <h2>Загрузка отзывов...</h2>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <Header />
      <main className="reviews-page">
        <section className="reviews-page__container container">
          <div className="reviews-page__hero">
            <div>
              <span className="section-badge">Отзывы</span>

              <h1 className="reviews-page__title">
                Отзывы родителей и клиентов центра
              </h1>

              <p className="reviews-page__subtitle">
                Здесь собраны отзывы о работе специалистов и услугах центра
                «РАСсвет».
              </p>
            </div>

            <div className="reviews-page__actions">
              {user?.role !== "teacher" && (
                <button
                  className="reviews-page__btn"
                  onClick={() => navigate("/create-review")}
                >
                  Написать отзыв
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="reviews-page__state reviews-page__state--error">
              <h2>{error}</h2>
            </div>
          )}

          {!error && reviews.length === 0 ? (
            <div className="reviews-page__state">
              <h2>Пока нет отзывов</h2>
              <p>Будьте первым, кто оставит отзыв.</p>
            </div>
          ) : (
            <div className="reviews-page__list">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
};

export default Reviews;
