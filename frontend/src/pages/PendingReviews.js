import "./AdminModule.scss";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Rating,
  CircularProgress,
  Chip,
  Tooltip,
  IconButton,
} from "@mui/material";
import {
  Check as ApproveIcon,
  Close as RejectIcon,
  ArrowBack as BackIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import reviewService from "../services/reviewService";

const PendingReviews = () => {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingReviews();
  }, []);

  const fetchPendingReviews = async () => {
    try {
      const data = await reviewService.getPendingReviews();
      setReviews(data);
    } catch {
      toast.error("Ошибка загрузки отзывов на модерации");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await reviewService.approveReview(id);
      toast.success("Отзыв одобрен");
      setReviews((prev) => prev.filter((r) => r.id !== id));
    } catch {
      toast.error("Ошибка одобрения отзыва");
    }
  };

  const handleReject = async (id) => {
    try {
      await reviewService.rejectReview(id);
      toast.success("Отзыв отклонён");
      setReviews((prev) => prev.filter((r) => r.id !== id));
    } catch {
      toast.error("Ошибка отклонения отзыва");
    }
  };

  const getAuthorName = (review) => {
    if (review.is_anonymous) return "Аноним";
    const first = review.user?.first_name || "";
    const last = review.user?.last_name || "";
    return `${first} ${last}`.trim() || "—";
  };

  return (
    <main className="admin-module">
      <div className="admin-module__container">
        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">CMS</span>
            <h1>Модерация отзывов</h1>
            <p>
              Отзывы, ожидающие проверки перед публикацией на сайте.
            </p>
          </div>
          <div className="admin-module__actions">
            <Button
              startIcon={<BackIcon />}
              onClick={() => navigate("/admin/reviews")}
              className="admin-module__button admin-module__button--ghost"
            >
              Все отзывы
            </Button>
          </div>
        </section>

        <section className="admin-module__panel">
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : reviews.length === 0 ? (
            <Box
              display="flex"
              alignItems="center"
              justifyContent="center"
              py={6}
              sx={{ color: "#55707f", fontSize: 16 }}
            >
              Нет отзывов на модерации
            </Box>
          ) : (
            <div className="pending-reviews__list">
              {reviews.map((review) => (
                <div key={review.id} className="pending-reviews__card">
                  <div className="pending-reviews__card-header">
                    <div className="pending-reviews__meta">
                      <span className="pending-reviews__author">
                        {getAuthorName(review)}
                      </span>
                      {review.is_anonymous && (
                        <Chip
                          label="Анонимно"
                          size="small"
                          sx={{
                            background: "#f0f4f8",
                            color: "#55707f",
                            fontWeight: 700,
                            fontSize: 11,
                            height: 22,
                            ml: 1,
                          }}
                        />
                      )}
                      {!review.is_anonymous && review.user?.email && (
                        <span className="pending-reviews__email">
                          {review.user.email}
                        </span>
                      )}
                    </div>
                    <span className="pending-reviews__date">
                      {new Date(review.created_at).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <Rating
                    value={review.rating}
                    readOnly
                    size="small"
                    sx={{ mb: 1 }}
                  />

                  <p className="pending-reviews__content">{review.content}</p>

                  <div className="pending-reviews__actions">
                    <Tooltip title="Одобрить и опубликовать">
                      <button
                        className="pending-reviews__btn pending-reviews__btn--approve"
                        onClick={() => handleApprove(review.id)}
                      >
                        <ApproveIcon fontSize="small" />
                        Одобрить
                      </button>
                    </Tooltip>
                    <Tooltip title="Отклонить отзыв">
                      <button
                        className="pending-reviews__btn pending-reviews__btn--reject"
                        onClick={() => handleReject(review.id)}
                      >
                        <RejectIcon fontSize="small" />
                        Отклонить
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default PendingReviews;
