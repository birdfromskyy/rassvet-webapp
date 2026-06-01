import React from 'react'
import { useNavigate } from 'react-router-dom'
import { getUploadUrl } from '../../services/cmsService'
import './NewsCard.scss'

const NewsCard = ({ article, variant = 'default' }) => {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate(`/news/${article.slug}`)
  }

  const formatDate = dateString => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getCategoryLabel = category => {
    const labels = {
      news: 'Новости',
      articles: 'Статьи',
      updates: 'Обновления',
      events: 'События',
    }

    return labels[category] || category
  }

  const imageUrl = getUploadUrl(article.featured_image)

  if (variant === 'compact') {
    return (
      <article className="news-card news-card--compact" onClick={handleClick}>
        {imageUrl && (
          <img className="news-card__compact-img" src={imageUrl} alt={article.title} />
        )}

        <div className="news-card__compact-content">
          <h3>{article.title}</h3>
          <span>{formatDate(article.published_at || article.date_created)}</span>
        </div>
      </article>
    )
  }

  return (
    <article className="news-card" onClick={handleClick}>
      {imageUrl && (
        <img className="news-card__image" src={imageUrl} alt={article.title} />
      )}

      <div className="news-card__content">
        <div className="news-card__meta">
          <span className="news-card__category">Новости</span>

          {article.view_count > 0 && (
            <span className="news-card__views">👁 {article.view_count}</span>
          )}
        </div>

        <h2>{article.title}</h2>

        {article.summary && <p>{article.summary}</p>}

        <div className="news-card__footer">
          <span>{formatDate(article.published_at || article.date_created)}</span>
          {article.author && <span>{article.author}</span>}
        </div>

        <button type="button" className="news-card__link">
          Читать далее
        </button>
      </div>
    </article>
  )
}

export default NewsCard