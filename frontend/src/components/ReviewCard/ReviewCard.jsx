import React from 'react'
import './ReviewCard.scss'

const ReviewCard = ({ review }) => {
  const getStatusLabel = status => {
    switch (status) {
      case 'approved':
        return 'Одобрен'

      case 'pending':
        return 'На модерации'

      case 'rejected':
        return 'Отклонён'

      default:
        return status
    }
  }

  const renderStars = rating => {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating)
  }

  return (
    <article className="review-card">
      <div className="review-card__top">
        <div>
          <h2>
            {review.author_name || 'Анонимный пользователь'}
          </h2>

          <div className="review-card__rating">
            {renderStars(review.rating)}
          </div>
        </div>

        {review.status && (
          <span className={`review-card__status review-card__status--${review.status}`}>
            {getStatusLabel(review.status)}
          </span>
        )}
      </div>

      <p className="review-card__content">
        {review.content}
      </p>

      <div className="review-card__bottom">
        <span>
          {new Date(review.created_at).toLocaleDateString('ru-RU')}
        </span>
      </div>
    </article>
  )
}

export default ReviewCard