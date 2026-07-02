import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/Header/Header'
import Footer from '../../components/Footer/Footer'
import './Support.scss'
import supportService, {
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_STATUS_LABEL,
} from '../../services/supportService'

export default function SupportList() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = 'РАСсвет | Техподдержка'
    supportService.listMyTickets()
      .then(setTickets)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className='support-page'>
      <Header />
      <main className='support'>
        <div className='page-container'>

          <div className='support__hero-row'>
            <div className='support__hero'>
              <span className='section-badge'>Техподдержка</span>
              <h1>Мои обращения</h1>
              <p>Здесь находятся все ваши обращения в службу поддержки центра «РАСсвет».</p>
            </div>
            <button
              className='support__btn support__btn--primary'
              onClick={() => navigate('/support/new')}
            >
              + Новое обращение
            </button>
          </div>

          {loading ? (
            <div className='support__loading'>
              <div className='support__spinner' />
            </div>
          ) : tickets.length === 0 ? (
            <div className='support__empty'>
              <p>У вас пока нет обращений.</p>
              <button
                className='support__btn support__btn--primary'
                onClick={() => navigate('/support/new')}
              >
                Создать первое обращение
              </button>
            </div>
          ) : (
            <div className='support__list'>
              {tickets.map(t => (
                <div
                  key={t.id}
                  className='support-item'
                  onClick={() => navigate(`/support/${t.id}`)}
                  role='button'
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate(`/support/${t.id}`)}
                >
                  <div className='support-item__body'>
                    <p className='support-item__subject'>{t.subject}</p>
                    <div className='support-item__meta'>
                      <span className='support-item__cat'>
                        {SUPPORT_CATEGORY_LABEL[t.category] || t.category}
                      </span>
                      <span className='support-item__date'>
                        {new Date(t.updated_at).toLocaleDateString('ru-RU', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                  <span className={`support-status support-status--${t.status}`}>
                    {SUPPORT_STATUS_LABEL[t.status] || t.status}
                  </span>
                </div>
              ))}
            </div>
          )}

        </div>
      </main>
      <Footer />
    </div>
  )
}
