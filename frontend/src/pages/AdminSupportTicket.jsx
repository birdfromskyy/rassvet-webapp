import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
  Box, Button, Chip, CircularProgress, FormControl,
  InputLabel, MenuItem, Select, Typography,
} from '@mui/material'
import { ArrowBack as BackIcon } from '@mui/icons-material'
import { FiFile, FiPaperclip, FiX } from 'react-icons/fi'
import supportService, {
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_STATUS_LABEL,
  SUPPORT_STATUS_COLOR,
} from '../services/supportService'
import './AdminModule.scss'
import './Support/Support.scss'

const MAX_FILES = Infinity
const MAX_FILE_MB = 5
const ALLOWED_EXTS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']
const POLL_INTERVAL = 60000

const STATUS_OPTIONS = [
  { value: 'open', label: 'Открыто' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'closed', label: 'Закрыто' },
]

const fmt = (iso) =>
  new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

export default function AdminSupportTicket() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const bottomRef = useRef(null)

  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [files, setFiles] = useState([])
  const [sending, setSending] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [savingStatus, setSavingStatus] = useState(false)

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    supportService.adminGetTicket(id)
      .then(data => {
        setTicket(data)
        setNewStatus(data.status)
      })
      .catch(() => navigate('/admin/support'))
      .finally(() => { if (!silent) setLoading(false) })
  }, [id, navigate])

  useEffect(() => {
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
      await supportService.adminReplyToTicket(id, { body: body.trim(), files })
      setBody('')
      setFiles([])
      load(true)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Ошибка отправки')
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async () => {
    if (!newStatus || newStatus === ticket?.status) return
    setSavingStatus(true)
    try {
      await supportService.adminUpdateStatus(id, newStatus)
      toast.success('Статус обновлён')
      load(true)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Ошибка')
    } finally {
      setSavingStatus(false)
    }
  }

  if (loading) return (
    <main className='admin-module'>
      <div className='admin-module__container'>
        <Box display='flex' justifyContent='center' p={8}>
          <CircularProgress />
        </Box>
      </div>
    </main>
  )

  if (!ticket) return null

  const user = ticket.user
  const userLabel = user ? `${user.first_name} ${user.last_name}` : `Пользователь #${ticket.user_id}`

  return (
    <main className='admin-module'>
      <div className='admin-module__container'>

        {/* Hero */}
        <section className='admin-module__hero'>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className='admin-module__badge'>Техподдержка</span>
            <h1 style={{ fontSize: 'clamp(28px, 4vw, 48px)', marginTop: 12 }}>
              {ticket.subject}
            </h1>
            <Box display='flex' alignItems='center' gap={1} flexWrap='wrap' mt={1}>
              <Chip
                label={SUPPORT_STATUS_LABEL[ticket.status] || ticket.status}
                color={SUPPORT_STATUS_COLOR[ticket.status] || 'default'}
                size='small'
              />
              <Chip
                label={SUPPORT_CATEGORY_LABEL[ticket.category] || ticket.category}
                size='small'
                sx={{ background: 'rgba(7,68,98,0.08)', color: '#55707f' }}
              />
              <Typography variant='caption' color='text.secondary'>
                #{ticket.id} · {userLabel} · {fmt(ticket.created_at)}
              </Typography>
            </Box>
          </div>
          <div className='admin-module__actions'>
            <Button
              startIcon={<BackIcon />}
              onClick={() => navigate('/admin/support')}
              className='admin-module__button admin-module__button--ghost'
            >
              Назад
            </Button>
          </div>
        </section>

        {/* Status panel */}
        <section className='admin-module__panel' style={{ marginBottom: 20 }}>
          <Typography variant='subtitle1' fontWeight={800} sx={{ mb: 2, color: '#074462' }}>
            Управление статусом
          </Typography>
          <Box display='flex' gap={2} alignItems='center' flexWrap='wrap'>
            <FormControl size='small' sx={{ minWidth: 200 }}>
              <InputLabel>Статус</InputLabel>
              <Select
                value={newStatus}
                label='Статус'
                onChange={e => setNewStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map(o => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant='contained'
              onClick={handleStatusChange}
              disabled={savingStatus || newStatus === ticket.status}
              sx={{
                borderRadius: '999px',
                textTransform: 'none',
                fontWeight: 900,
                background: '#f4df00',
                color: '#074462',
                boxShadow: 'none',
                '&:hover': { background: '#e8d300', boxShadow: 'none' },
              }}
            >
              {savingStatus ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </Box>
        </section>

        {/* Conversation */}
        <section className='admin-module__panel'>
          <Typography variant='subtitle1' fontWeight={800} sx={{ mb: 2, color: '#074462' }}>
            Переписка
          </Typography>

          <div className='support-conv'>
            {(ticket.messages || []).map(msg => (
              <div
                key={msg.id}
                className={`support-msg ${msg.is_admin_reply ? 'support-msg--user' : 'support-msg--admin'}`}
              >
                <div className='support-msg__from'>
                  {msg.is_admin_reply ? 'Вы (администратор)' : userLabel}
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
          {ticket.status !== 'closed' && (
            <div className='support-reply' style={{ marginTop: 24 }}>
              <form onSubmit={handleSend}>
                <textarea
                  className='support-reply__textarea'
                  placeholder='Написать ответ пользователю...'
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
                    {files.length > 0 ? `Файл (${files.length})` : 'Прикрепить файл'}
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
                    {sending ? 'Отправка...' : 'Отправить ответ'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {ticket.status === 'closed' && (
            <div className='support__alert' style={{ marginTop: 20 }}>
              <span>Обращение закрыто. Для возобновления переписки переведите статус в «Открыто» или «В работе».</span>
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
