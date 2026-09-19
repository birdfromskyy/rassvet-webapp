import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NewsCard from '../NewsCard/NewsCard'
import newsService from '../../services/newsService'
import './NewsSection.scss'

const NewsSection = ({ limit = 3 }) => {
  const navigate = useNavigate()

  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchLatestArticles()
  }, [])

  const fetchLatestArticles = async () => {
    try {
      const data = await newsService.getLatestArticles(limit)
      setArticles(data || [])
    } catch (error) {
      console.error(error)
      setError('Не удалось загрузить новости')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <section className="news-section">
        <div className="news-section__state">
          <h3>Загрузка новостей...</h3>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="news-section">
        <div className="news-section__state news-section__state--error">
          <h3>{error}</h3>
        </div>
      </section>
    )
  }

  if (articles.length === 0) {
    return null
  }

  return (
    <section className="news-section">
      <div className="news-section__top">
        <div>
          <span className="section-badge">Новости центра</span>

          <h2>Последние события и обновления</h2>
        </div>

        <button
          className="news-section__all"
          onClick={() => navigate('/news')}
        >
          Все новости →
        </button>
      </div>

      <div className="news-section__grid">
        {articles.map(article => (
          <NewsCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  )
}

export default NewsSection