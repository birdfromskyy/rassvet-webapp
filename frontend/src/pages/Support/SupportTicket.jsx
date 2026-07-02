import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { FiArrowLeft, FiFile, FiPaperclip, FiX } from 'react-icons/fi'
import Header from '../../components/Header/Header'
import Footer from '../../components/Footer/Footer'
import './Support.scss'
import supportService, {
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_STATUS_LABEL,
} from '../../services/supportService'

const MAX_FILES = 10
const MAX_FILE_MB = 5
const ALLOWED_EXTS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']
const POLL_INTERVAL = 60000

const fmt = (iso) =>
  new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

export default function SupportTicket() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const bottomRef = useRef(null)

  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [files, setFiles] = useState([])
  const [sending, setSending] = useState(false)
  const [closing, setClosing] = useState(false)

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    supportService.getMyTicket(id)
      .then(setTicket)
      .catch(() => navigate('/support'))
      .finally(() => { if (!silent) setLoading(false) })
  }, [id, navigate])

  useEffect(() => {
    document.title = 'РАСсвет | Техподдержка'
    load()
    const interval = setInterval(() => load(true), POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    if (ticket) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [ticket?.messages?.length])

  const handleFiles = (e) => {
    const picked = Array.from(e.target.files || [])
    const combined = [...files]
    for (const f of picked) {
      if (combined.length >= MAX_FILES) { toast.error(`Максимум ${MAX_FILES} файлов`); break }
      if (f.size > MAX_FILE_MB * 1024 * 1024) { toast.error(`«${f.name}» превышает ${MAX_FILE_MB} МБ`); continue }
      const ext = '.' + f.name.split('.').pop().toLowerCase()
      if (!ALLOWED_EXTS.includes(ext)) { toast.error(`«${f.name}» — недопустимый формат`); continue }
      combined.push(f)
    }
    setFiles(combined)
    e.target.value = ''
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!body.trim() && files.length === 0) return
    setSending(true)
    try {
      await supportService.replyToTicket(id, { body: body.trim(), files })
      setBody('')
      setFiles([])
      load(true)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Ошибка отправки')
    } finally {
      setSending(false)
    }
  }

  const handleClose = async () => {
    setClosing(true)
    try {
      await supportService.closeMyTicket(id)
      toast.success('Обращение закрыто')
      load(true)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Ошибка')
    } finally {
      setClosing(false)
    }
  }

  if (loading) return (
    <div className='support-page'>
      <Header />
      <main className='support'>
        <div className='page-container'>
          <div className='support__loading'><div className='support__spinner' /></div>
        </div>
      </main>
      <Footer />
    </div>
  )

  if (!ticket) return null
  const isClosed = ticket.status === 'closed'

  return (
    <div className='support-page'>
      <Header />
      <main className='support'>
        <div className='page-container'>

          {/* Header */}
          <div className='support__ticket-header'>
            <button
              className='support__back-btn'
              onClick={() => navigate('/support')}
              aria-label='Назад'
            >
              <FiArrowLeft size={18} />
            </button>
            <div className='support__ticket-title'>
              <h2>{ticket.subject}</h2>
              <div className='support__ticket-meta'>
                <span className={`support-status support-status--${ticket.status}`}>
                  {SUPPORT_STATUS_LABEL[ticket.status] || ticket.status}
                </span>
                <span className='support-status support-status--closed' style={{ background: 'rgba(7,68,98,0.06)', color: '#55707f' }}>
                  {SUPPORT_CATEGORY_LABEL[ticket.category] || ticket.category}
                </span>
                <span className='support__ticket-id'>№{ticket.id} · {fmt(ticket.created_at)}</span>
              </div>
            </div>
            {!isClosed && (
              <button
                className='support__btn support__btn--danger support__btn--sm'
                onClick={handleClose}
                disabled={closing}
              >
                {closing ? 'Закрытие...' : 'Закрыть'}
              </button>
            )}
          </div>

          {/* Closed alert */}
          {isClosed && (
            <div className='support__alert'>
              <span>Обращение закрыто. Для нового вопроса</span>
              <button onClick={() => navigate('/support/new')}>создайте новое обращение</button>.
            </div>
          )}

          {/* Conversation */}
          <div className='support__card'>
            <div className='support-conv'>
              {(ticket.messages || []).map(msg => (
                <div
                  key={msg.id}
                  className={`support-msg ${msg.is_admin_reply ? 'support-msg--admin' : 'support-msg--user'}`}
                >
                  <div className='support-msg__from'>
                    {msg.is_admin_reply ? 'Служба поддержки' : 'Вы'}
                  </div>
                  <div className='support-msg__bubble'>{msg.body}</div>
                  {msg.attachments?.length > 0 && (
                    <div className='support-msg__files'>
                      {msg.attachments.map(a => (
                        <a
                          key={a.id}
                          href={supportService.fileUrl(a.filename)}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='support-msg__file'
                          title={a.original_name}
                        >
                          <FiFile size={13} />
                          <span>{a.original_name}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  <div className='support-msg__date'>{fmt(msg.created_at)}</div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Reply */}
            {!isClosed && (
              <div className='support-reply'>
                <form onSubmit={handleSend}>
                  <textarea
                    className='support-reply__textarea'
                    placeholder='Написать сообщение...'
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    maxLength={5000}
                  />
                  {files.length > 0 && (
                    <div className='support-attach__chips' style={{ marginBottom: 10 }}>
                      {files.map((f, i) => (
                        <div key={i} className='support-attach__chip'>
                          <span>{f.name}</span>
                          <button
                            type='button'
                            onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                            aria-label='Удалить'
                          >
                            <FiX size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className='support-reply__row'>
                    <button
                      type='button'
                      className='support-attach__btn'
                      disabled={files.length >= MAX_FILES}
                      onClick={() => fileRef.current?.click()}
                    >
                      <FiPaperclip size={14} />
                      Файл ({files.length}/{MAX_FILES})
                    </button>
                    <input
                      ref={fileRef}
                      type='file'
                      multiple
                      hidden
                      accept={ALLOWED_EXTS.join(',')}
                      onChange={handleFiles}
                    />
                    <button
                      type='submit'
                      className='support__btn support__btn--primary support__btn--sm'
                      disabled={sending || (!body.trim() && files.length === 0)}
                    >
                      {sending ? 'Отправка...' : 'Отправить'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

        </div>
      </main>
      <Footer />
    </div>
  )
}
