import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { FiArrowLeft, FiPaperclip, FiX } from 'react-icons/fi'
import Header from '../../components/Header/Header'
import Footer from '../../components/Footer/Footer'
import './Support.scss'
import supportService, { SUPPORT_CATEGORIES } from '../../services/supportService'

const MAX_FILES = 10
const MAX_FILE_MB = 5
const ALLOWED_EXTS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']

export default function SupportNew() {
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('')
  const [body, setBody] = useState('')
  const [files, setFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (subject.trim().length < 5) e.subject = 'Минимум 5 символов'
    if (subject.trim().length > 200) e.subject = 'Максимум 200 символов'
    if (!category) e.category = 'Выберите категорию'
    if (body.trim().length < 10) e.body = 'Минимум 10 символов'
    if (body.trim().length > 5000) e.body = 'Максимум 5000 символов'
    return e
  }

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setSubmitting(true)
    try {
      const ticket = await supportService.createTicket({
        subject: subject.trim(), category, body: body.trim(), files,
      })
      toast.success('Обращение отправлено')
      navigate(`/support/${ticket.id}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Ошибка отправки')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='support-page'>
      <Header />
      <main className='support'>
        <div className='page-container'>

          <div className='support__hero'>
            <span className='section-badge'>Техподдержка</span>
            <h1>Новое обращение</h1>
            <p>Опишите проблему — мы ответим в кратчайшие сроки.</p>
          </div>

          <div className='support__card'>
            <form className='support-form' onSubmit={handleSubmit}>

              <div className='support-form__field'>
                <label htmlFor='category'>Категория</label>
                <select
                  id='category'
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className={errors.category ? 'is-error' : ''}
                >
                  <option value=''>Выберите категорию...</option>
                  {SUPPORT_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                {errors.category && <span className='support-form__error'>{errors.category}</span>}
              </div>

              <div className='support-form__field'>
                <label htmlFor='subject'>Заголовок</label>
                <input
                  id='subject'
                  type='text'
                  placeholder='Кратко опишите суть вопроса'
                  value={subject}
                  maxLength={200}
                  onChange={e => setSubject(e.target.value)}
                  className={errors.subject ? 'is-error' : ''}
                />
                {errors.subject
                  ? <span className='support-form__error'>{errors.subject}</span>
                  : <span className='support-form__hint'>{subject.length}/200</span>}
              </div>

              <div className='support-form__field'>
                <label htmlFor='body'>Описание проблемы</label>
                <textarea
                  id='body'
                  placeholder='Подробно опишите проблему, что именно происходит...'
                  value={body}
                  maxLength={5000}
                  onChange={e => setBody(e.target.value)}
                  className={errors.body ? 'is-error' : ''}
                />
                {errors.body
                  ? <span className='support-form__error'>{errors.body}</span>
                  : <span className='support-form__hint'>{body.length}/5000</span>}
              </div>

              {/* Attachments */}
              <div className='support-form__field'>
                <label>Вложения</label>
                <div className='support-attach'>
                  <button
                    type='button'
                    className='support-attach__btn'
                    disabled={files.length >= MAX_FILES}
                    onClick={() => fileRef.current?.click()}
                  >
                    <FiPaperclip />
                    Прикрепить файл ({files.length}/{MAX_FILES})
                  </button>
                  <input
                    ref={fileRef}
                    type='file'
                    multiple
                    hidden
                    accept={ALLOWED_EXTS.join(',')}
                    onChange={handleFiles}
                  />
                  <span className='support-attach__hint'>
                    PDF, JPG, PNG, DOC, DOCX — до {MAX_FILE_MB} МБ каждый
                  </span>
                  {files.length > 0 && (
                    <div className='support-attach__chips'>
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
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type='button'
                  className='support__btn support__btn--ghost'
                  onClick={() => navigate('/support')}
                  disabled={submitting}
                >
                  <FiArrowLeft />
                  Назад
                </button>
                <button
                  type='submit'
                  className='support__btn support__btn--primary'
                  disabled={submitting}
                >
                  {submitting ? 'Отправка...' : 'Отправить обращение'}
                </button>
              </div>

            </form>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  )
}
