import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import authService from '../../services/authService'
import documentService from '../../services/documentService'
import questionnaireService from '../../services/questionnaireService'
import consultationService from '../../services/consultationService'
import './Profile.scss'

import Header from '../../components/Header/Header'
import Footer from '../../components/Footer/Footer'

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_PARENT_FILES = 5
const MAX_CHILD_FILES  = 10
const MAX_CHILDREN     = 5
const MAX_FILE_MB      = 5
const ALLOWED_TYPES    = ['application/pdf', 'image/jpeg', 'image/png']
const ALLOWED_EXT_STR  = 'PDF, JPG, PNG'

// ── Small helpers ────────────────────────────────────────────────────────────
const safeParseJSON = (str) => {
  try {
    const val = JSON.parse(str)
    return Array.isArray(val) ? val : []
  } catch { return [] }
}

// DB: +79123456789  → display: +7 912 345 67 89
const formatPhone = (raw) => {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 11) return raw
  return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`
}

// Format 10 raw digits as "+7 XXX XXX XX XX"
const buildPhoneDisplay = (digits10) => {
  let s = '+7'
  if (digits10.length > 0) s += ' ' + digits10.slice(0, 3)
  if (digits10.length > 3) s += ' ' + digits10.slice(3, 6)
  if (digits10.length > 6) s += ' ' + digits10.slice(6, 8)
  if (digits10.length > 8) s += ' ' + digits10.slice(8, 10)
  return s
}

// display "+7 912 345 67 89" → DB "+79123456789"
const parsePhoneInput = (display) => {
  const digits = display.replace(/\D/g, '') // all digits incl. leading 7
  if (digits.length < 2) return ''
  return '+' + digits
}

const statusLabel = {
  draft:    { text: 'Черновик',    cls: 'status--draft' },
  pending:  { text: 'На проверке', cls: 'status--pending' },
  verified: { text: 'Подтверждён', cls: 'status--approved' },
  approved: { text: 'Принято',     cls: 'status--approved' },
  rejected: { text: 'Отклонено',   cls: 'status--rejected' },
}

// ── FileDropZone ─────────────────────────────────────────────────────────────
const FileDropZone = ({ label, files, existingFiles, onAdd, onRemoveExisting, onRemoveNew, maxFiles }) => {
  const inputRef = useRef(null)
  const totalCount = existingFiles.length + files.length
  const canAdd = totalCount < maxFiles

  const handleDrop = (e) => {
    e.preventDefault()
    if (!canAdd) return
    const dropped = Array.from(e.dataTransfer.files)
    addFiles(dropped)
  }

  const handleChange = (e) => {
    addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const addFiles = (incoming) => {
    const validated = []
    for (const f of incoming) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        toast.error(`«${f.name}» — недопустимый формат. Разрешены ${ALLOWED_EXT_STR}`)
        continue
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`«${f.name}» превышает ${MAX_FILE_MB} МБ`)
        continue
      }
      if (existingFiles.length + files.length + validated.length >= maxFiles) {
        toast.warn(`Максимум ${maxFiles} файлов`)
        break
      }
      validated.push(f)
    }
    if (validated.length > 0) onAdd(validated)
  }

  return (
    <div className="doc-zone">
      <span className="doc-zone__label">{label}</span>
      <div
        className={`doc-zone__drop${canAdd ? '' : ' doc-zone__drop--full'}`}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => canAdd && inputRef.current?.click()}
      >
        {canAdd
          ? <span>Перетащите файлы или нажмите · {ALLOWED_EXT_STR} · макс. {MAX_FILE_MB} МБ</span>
          : <span>Достигнут лимит ({maxFiles} файлов)</span>
        }
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          style={{ display: 'none' }}
          onChange={handleChange}
        />
      </div>

      {(existingFiles.length > 0 || files.length > 0) && (
        <ul className="doc-zone__list">
          {existingFiles.map(filename => (
            <li key={filename} className="doc-zone__item">
              <a
                href={documentService.fileUrl(filename)}
                target="_blank"
                rel="noreferrer"
                className="doc-zone__filename"
              >
                {filename}
              </a>
              <button
                type="button"
                className="doc-zone__remove"
                onClick={() => onRemoveExisting(filename)}
                title="Удалить"
              >×</button>
            </li>
          ))}
          {files.map((f, i) => (
            <li key={i} className="doc-zone__item doc-zone__item--new">
              <span className="doc-zone__filename">{f.name}</span>
              <button
                type="button"
                className="doc-zone__remove"
                onClick={() => onRemoveNew(i)}
                title="Удалить"
              >×</button>
            </li>
          ))}
        </ul>
      )}

      <p className="doc-zone__hint">
        {totalCount} / {maxFiles} файлов
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
const Profile = ({ user, onUpdateUser, onLogout }) => {
  const navigate = useNavigate()

  useEffect(() => { document.title = 'Профиль' }, [])

  // ── Profile form ──────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', middle_name: '', email: '',
    password: '', confirmPassword: '',
  })
  const [errors, setErrors]   = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '', last_name: user.last_name || '',
        middle_name: user.middle_name || '', email: user.email || '',
        password: '', confirmPassword: '',
      })
    }
  }, [user])

  const handleChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: '' })
  }

  const validate = () => {
    const errs = {}
    if (!formData.first_name.trim()) errs.first_name = 'Имя обязательно'
    if (!formData.last_name.trim())  errs.last_name  = 'Фамилия обязательна'
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) errs.email = 'Email недействителен'
    if (formData.password) {
      if (formData.password.length < 8)         errs.password = 'Пароль должен быть не менее 8 символов'
      else if (!/[A-Z]/.test(formData.password)) errs.password = 'Пароль должен содержать хотя бы одну заглавную букву'
      else if (!/[0-9]/.test(formData.password)) errs.password = 'Пароль должен содержать хотя бы одну цифру'
      if (formData.password !== formData.confirmPassword) errs.confirmPassword = 'Пароли не совпадают'
    }
    return errs
  }

  const handleSubmit = async e => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setLoading(true)
    try {
      const data = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        middle_name: formData.middle_name,
      }
      if (formData.email !== user?.email) data.email = formData.email
      if (formData.password) data.password = formData.password
      const response = await authService.updateProfile(data)
      if (response.emailChanged) {
        toast.info('Email изменен. Требуется повторная верификация')
        onLogout()
        setTimeout(() => navigate(`/verify-email?email=${encodeURIComponent(response.email)}`), 1500)
        return
      }
      onUpdateUser(response.user)
      toast.success('Профиль обновлен')
    } catch (error) {
      if (error.response?.status === 409) setErrors({ email: 'Email уже используется' })
      else toast.error(error.response?.data?.error || 'Ошибка обновления профиля')
    } finally {
      setLoading(false)
    }
  }

  // ── Consultations & questionnaire ────────────────────────────────────────
  const [consultations, setConsultations] = useState([])
  const [qData, setQData]               = useState(null)   // full questionnaire object
  const [qStatus, setQStatus]           = useState(null)   // status string

  // ── Document state ────────────────────────────────────────────────────────
  const [docsLoading, setDocsLoading]         = useState(true)
  const [parentProfile, setParentProfile]     = useState(null)
  const [children, setChildren]               = useState([])

  // Parent doc form state
  const [phoneDisplay, setPhoneDisplay]       = useState('')
  const [keepPassport, setKeepPassport]       = useState([])
  const [keepSnils, setKeepSnils]             = useState([])
  const [newPassport, setNewPassport]         = useState([])
  const [newSnils, setNewSnils]               = useState([])
  const [parentSaving, setParentSaving]       = useState(false)

  // Child add form state
  const [childFormOpen, setChildFormOpen]       = useState(false)
  const [childName, setChildName]               = useState('')
  const [ippsuFiles, setIppsuFiles]             = useState([])
  const [birthCertFiles, setBirthCertFiles]     = useState([])
  const [childSnilsFiles, setChildSnilsFiles]   = useState([])
  const [childSaving, setChildSaving]           = useState(false)
  const [ippsuConsentGiven, setIppsuConsentGiven] = useState(false)

  // Account deletion state
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)

  // Child edit form state (for rejected submissions)
  const [editingChildId, setEditingChildId]   = useState(null)
  const [editChildName, setEditChildName]     = useState('')
  const [editKeepIppsu, setEditKeepIppsu]     = useState([])
  const [editKeepBirth, setEditKeepBirth]     = useState([])
  const [editKeepSnils, setEditKeepSnils]     = useState([])
  const [editNewIppsu, setEditNewIppsu]       = useState([])
  const [editNewBirth, setEditNewBirth]       = useState([])
  const [editNewSnils, setEditNewSnils]       = useState([])
  const [editSaving, setEditSaving]           = useState(false)

  const loadDocs = useCallback(async () => {
    try {
      const [data, q, consults] = await Promise.all([
        documentService.getMyDocuments(),
        questionnaireService.getMine().catch(() => null),
        consultationService.getMine().catch(() => []),
      ])
      const profile = data.parent_profile || {}
      setParentProfile(profile)
      setChildren(data.children || [])
      setPhoneDisplay(profile.phone ? formatPhone(profile.phone) : '+7')
      setKeepPassport(safeParseJSON(profile.passport_files))
      setKeepSnils(safeParseJSON(profile.snils_files))
      setNewPassport([])
      setNewSnils([])
      setQData(q || null)
      setQStatus(q?.status || null)
      setConsultations(Array.isArray(consults) ? consults : [])
    } catch {
      toast.error('Ошибка загрузки документов')
    } finally {
      setDocsLoading(false)
    }
  }, [])

  useEffect(() => { loadDocs() }, [loadDocs])

  // ── Phone input handlers ──────────────────────────────────────────────────
  // Extract digits after the +7 prefix, reformat, set state.
  const handlePhoneChange = (e) => {
    const all = e.target.value.replace(/\D/g, '') // all digits
    // Strip leading 7 (comes from "+7" prefix)
    const after7 = all.startsWith('7') ? all.slice(1) : all
    setPhoneDisplay(buildPhoneDisplay(after7.slice(0, 10)))
  }

  // Prevent deleting the "+7" prefix (first 3 chars "+7 ").
  const handlePhoneKeyDown = (e) => {
    const pos = e.target.selectionStart
    if (e.key === 'Backspace' && pos <= 3) { e.preventDefault(); return }
    if (e.key === 'Delete'    && pos <= 2) { e.preventDefault(); return }
  }

  // On focus, move cursor to end so user types after existing digits.
  const handlePhoneFocus = (e) => {
    const len = e.target.value.length
    e.target.setSelectionRange(len, len)
  }

  // Prevent clicking into the "+7 " zone.
  const handlePhoneClick = (e) => {
    if (e.target.selectionStart < 3) e.target.setSelectionRange(3, 3)
  }

  // ── Save parent docs ──────────────────────────────────────────────────────
  const handleSaveParent = async (e) => {
    e.preventDefault()
    const phoneRaw    = parsePhoneInput(phoneDisplay)
    const phoneToSend = phoneRaw === '+7' || phoneRaw === '' ? '' : phoneRaw

    const totalPassport = keepPassport.length + newPassport.length
    const totalSnils    = keepSnils.length + newSnils.length
    const hasPhone      = !!phoneToSend

    // All three must be filled or all empty (can't save partial)
    if (hasPhone || totalPassport > 0 || totalSnils > 0) {
      if (!hasPhone)          { toast.error('Укажите номер телефона'); return }
      if (totalPassport === 0){ toast.error('Загрузите файлы паспорта'); return }
      if (totalSnils === 0)   { toast.error('Загрузите файлы СНИЛС'); return }
    }

    if (phoneToSend && !/^\+7\d{10}$/.test(phoneToSend)) {
      toast.error('Формат номера: +7 XXX XXX XX XX (10 цифр после +7)')
      return
    }
    setParentSaving(true)
    try {
      const data = await documentService.saveParentDocs({
        phone: phoneToSend,
        keepPassport,
        keepSnils,
        passportFiles: newPassport,
        snilsFiles: newSnils,
      })
      setParentProfile(data.parent_profile)
      setKeepPassport(safeParseJSON(data.parent_profile.passport_files))
      setKeepSnils(safeParseJSON(data.parent_profile.snils_files))
      setNewPassport([])
      setNewSnils([])
      toast.success('Документы родителя сохранены')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Ошибка сохранения')
    } finally {
      setParentSaving(false)
    }
  }

  // ── Add child submission ──────────────────────────────────────────────────
  const handleAddChild = async (e) => {
    e.preventDefault()
    if (!childName.trim())      { toast.error('Укажите имя ребёнка'); return }
    if (ippsuFiles.length === 0)      { toast.error('Загрузите ИППСУ'); return }
    if (birthCertFiles.length === 0)  { toast.error('Загрузите свидетельство о рождении'); return }
    if (childSnilsFiles.length === 0) { toast.error('Загрузите СНИЛС ребёнка'); return }
    if (!ippsuConsentGiven) { toast.error('Необходимо согласие на обработку сведений о здоровье ребёнка (ИППСУ)'); return }
    setChildSaving(true)
    try {
      await documentService.addChildDocs({
        childName: childName.trim(),
        ippsuFiles,
        birthCertFiles,
        childSnilsFiles,
      })
      toast.success('Документы ребёнка отправлены на проверку')
      setChildFormOpen(false)
      setChildName('')
      setIppsuFiles([])
      setBirthCertFiles([])
      setChildSnilsFiles([])
      setIppsuConsentGiven(false)
      loadDocs()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Ошибка отправки')
    } finally {
      setChildSaving(false)
    }
  }

  // ── Open / cancel edit mode ──────────────────────────────────────────────
  const openEditChild = (ch) => {
    setEditingChildId(ch.id)
    setEditChildName(ch.child_name)
    setEditKeepIppsu(safeParseJSON(ch.ippsu_files))
    setEditKeepBirth(safeParseJSON(ch.birth_cert_files))
    setEditKeepSnils(safeParseJSON(ch.child_snils_files))
    setEditNewIppsu([])
    setEditNewBirth([])
    setEditNewSnils([])
  }

  const cancelEditChild = () => setEditingChildId(null)

  // ── Submit edited child submission ────────────────────────────────────────
  const handleUpdateChild = async (e) => {
    e.preventDefault()
    if (!editChildName.trim()) { toast.error('Укажите имя ребёнка'); return }
    if (editKeepIppsu.length + editNewIppsu.length === 0)      { toast.error('Загрузите ИППСУ'); return }
    if (editKeepBirth.length + editNewBirth.length === 0)      { toast.error('Загрузите свидетельство о рождении'); return }
    if (editKeepSnils.length + editNewSnils.length === 0)      { toast.error('Загрузите СНИЛС ребёнка'); return }
    setEditSaving(true)
    try {
      await documentService.updateChildDocs(editingChildId, {
        childName: editChildName.trim(),
        keepIppsu: editKeepIppsu,
        keepBirth: editKeepBirth,
        keepChildSnils: editKeepSnils,
        ippsuFiles: editNewIppsu,
        birthCertFiles: editNewBirth,
        childSnilsFiles: editNewSnils,
      })
      toast.success('Заявка обновлена и отправлена на повторную проверку')
      setEditingChildId(null)
      loadDocs()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Ошибка обновления')
    } finally {
      setEditSaving(false)
    }
  }

  // ── Delete child submission ───────────────────────────────────────────────
  const handleDeleteChild = async (id) => {
    if (!window.confirm('Удалить документы ребёнка? Это действие нельзя отменить.')) return
    try {
      await documentService.deleteChildSubmission(id)
      toast.success('Заявка удалена')
      loadDocs()
    } catch {
      toast.error('Ошибка удаления')
    }
  }

  const canAddChild = children.length < MAX_CHILDREN

  const handleDeleteParentProfile = async () => {
    if (!window.confirm('Удалить документы родителя (паспорт, СНИЛС)? Это действие нельзя отменить.')) return
    try {
      await documentService.deleteMyParentProfile()
      toast.success('Документы родителя удалены')
      loadDocs()
    } catch {
      toast.error('Ошибка удаления')
    }
  }

  const handleDeleteAccount = async () => {
    setDeleteAccountLoading(true)
    try {
      await authService.deleteAccount()
      toast.success('Аккаунт удалён')
      if (onLogout) onLogout()
      navigate('/')
    } catch {
      toast.error('Ошибка при удалении аккаунта. Попробуйте позже.')
    } finally {
      setDeleteAccountLoading(false)
      setDeleteAccountOpen(false)
    }
  }

  return (
    <>
      <Header />
      <main className="profile-page">
        <section className="profile">
          <div className="profile__container container">
            <div className="profile__header">
              <div>
                <span className="section-badge">Личный кабинет</span>
                <h1 className="profile__title">Профиль пользователя</h1>
                <p className="profile__subtitle">
                  Здесь можно изменить личные данные, email и пароль.
                </p>
              </div>
            </div>

            {/* ── Personal data form ── */}
            <form className="profile__card" onSubmit={handleSubmit}>
              <div className="profile__section">
                <h2>Личные данные</h2>
                <div className="profile__grid profile__grid--three">
                  <label className="profile__field">
                    <span>Фамилия</span>
                    <input name="last_name" value={formData.last_name} onChange={handleChange}
                      required maxLength={100} className={errors.last_name ? 'is-error' : ''} />
                    {errors.last_name && <small>{errors.last_name}</small>}
                  </label>
                  <label className="profile__field">
                    <span>Имя</span>
                    <input name="first_name" value={formData.first_name} onChange={handleChange}
                      required maxLength={100} className={errors.first_name ? 'is-error' : ''} />
                    {errors.first_name && <small>{errors.first_name}</small>}
                  </label>
                  <label className="profile__field">
                    <span>Отчество</span>
                    <input name="middle_name" value={formData.middle_name} onChange={handleChange}
                      maxLength={100} />
                  </label>
                </div>
              </div>

              <div className="profile__section">
                <h2>Учетные данные</h2>
                <div className="profile__grid">
                  <label className="profile__field">
                    <span>Email</span>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      maxLength={254}
                      className={errors.email ? 'is-error' : ''}
                    />
                    <small>{errors.email || 'При смене email потребуется повторная верификация'}</small>
                  </label>
                </div>
                <div className="profile__notice">
                  Оставьте поля паролей пустыми, если не хотите его менять.
                </div>
                <div className="profile__grid profile__grid--two">
                  <label className="profile__field">
                    <span>Новый пароль</span>
                    <input
                      type="password" name="password"
                      value={formData.password} onChange={handleChange}
                      className={errors.password ? 'is-error' : ''}
                    />
                    {errors.password && <small>{errors.password}</small>}
                  </label>
                  <label className="profile__field">
                    <span>Подтвердите пароль</span>
                    <input
                      type="password" name="confirmPassword"
                      value={formData.confirmPassword} onChange={handleChange}
                      className={errors.confirmPassword ? 'is-error' : ''}
                    />
                    {errors.confirmPassword && <small>{errors.confirmPassword}</small>}
                  </label>
                </div>
              </div>

              <div className="profile__actions">
                <button type="submit" className="profile__save" disabled={loading}>
                  {loading ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </div>
            </form>

            {/* ── Consultation requests ── */}
            {!docsLoading && (
              <div className="profile__card" style={{ marginTop: 32 }}>
                <div className="profile__section">
                  <div className="docs-section-head">
                    <h2>Заявки на консультацию</h2>
                    {consultations.length > 0 && (
                      <span className="docs-count">{consultations.length}</span>
                    )}
                  </div>

                  {consultations.length === 0 ? (
                    <div className="profile__empty-state">
                      <p className="docs-hint">У вас пока нет заявок на консультацию.</p>
                      <Link to="/consultation-request" className="profile__cta-btn">
                        Подать заявку на консультацию
                      </Link>
                    </div>
                  ) : (
                    <div className="consult-list">
                      {consultations.map(c => {
                        const st = statusLabel[c.status] || { text: c.status, cls: '' }
                        return (
                          <div key={c.id} className="consult-card">
                            <div className="consult-card__header">
                              <span className="consult-card__child">{c.child_fio} ({c.child_age})</span>
                              <span className={`docs-status ${st.cls}`}>{st.text === 'На проверке' ? 'Новая' : st.text === 'Подтверждён' ? 'Обработана' : st.text}</span>
                            </div>
                            <p className="consult-card__meta">
                              Связь: <strong>{c.contact_method}{c.contact_email ? ` (${c.contact_email})` : ''}</strong>
                              {' · '}
                              {new Date(c.created_at).toLocaleDateString('ru-RU')}
                            </p>
                            {c.admin_note && (
                              <p className="consult-card__note">Примечание: {c.admin_note}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Questionnaire ── */}
            {!docsLoading && (
              <div className="profile__card" style={{ marginTop: 24 }}>
                <div className="profile__section">
                  <div className="docs-section-head">
                    <h2>Анкета</h2>
                    {qData && (
                      <span className={`docs-status ${statusLabel[qData.status]?.cls || ''}`}>
                        {statusLabel[qData.status]?.text || qData.status}
                      </span>
                    )}
                  </div>

                  {!qData ? (
                    <div className="profile__empty-state">
                      <p className="docs-hint">Анкета не загружена. Для подачи документов необходимо пройти анкетирование.</p>
                      <Link to="/service-algorithm" className="profile__cta-btn">
                        Перейти к анкетированию
                      </Link>
                    </div>
                  ) : (
                    <div className="questionnaire-info">
                      <p className="docs-hint">
                        {qData.status === 'approved' && 'Анкета одобрена. Вы можете подавать документы.'}
                        {qData.status === 'pending' && 'Анкета отправлена и ожидает проверки администратором.'}
                        {qData.status === 'rejected' && 'Требуется уточнение по анкете. Загрузите новую версию.'}
                      </p>
                      {qData.admin_note && (
                        <p className="consult-card__note">Примечание администратора: {qData.admin_note}</p>
                      )}
                      <Link to="/service-algorithm" className="profile__cta-btn profile__cta-btn--secondary">
                        {qData.status === 'rejected' ? 'Загрузить новую анкету' : 'Открыть страницу анкеты'}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Documents block ── */}
            {docsLoading ? (
              <div className="profile__card" style={{ marginTop: 32 }}>
                <p style={{ color: '#1f678f' }}>Загрузка документов...</p>
              </div>
            ) : (
              <>
                {/* Show documents only if questionnaire approved OR user already has a profile (existing users) */}
                {(qStatus === 'approved' || parentProfile?.status) ? (
                <>
                {/* Parent documents */}
                <form className="profile__card docs-card" onSubmit={handleSaveParent} style={{ marginTop: 32 }}>
                  <div className="profile__section">
                    <div className="docs-section-head">
                      <h2>Документы родителя</h2>
                      {parentProfile?.status && (
                        <span className={`docs-status ${statusLabel[parentProfile.status]?.cls || ''}`}>
                          {statusLabel[parentProfile.status]?.text || parentProfile.status}
                        </span>
                      )}
                    </div>
                    <p className="docs-hint">
                      Загрузите паспорт и СНИЛС — администратор свяжется с вами по указанному номеру.
                      Допустимые форматы: {ALLOWED_EXT_STR}. Максимум {MAX_PARENT_FILES} файлов на тип документа, до {MAX_FILE_MB} МБ каждый.
                    </p>

                    <label className="profile__field" style={{ maxWidth: 340 }}>
                      <span>Номер телефона</span>
                      <input
                        type="tel"
                        value={phoneDisplay}
                        onChange={handlePhoneChange}
                        onKeyDown={handlePhoneKeyDown}
                        onFocus={handlePhoneFocus}
                        onClick={handlePhoneClick}
                        placeholder="+7 912 345 67 89"
                        maxLength={16}
                      />
                      <small>Введите 10 цифр после +7</small>
                    </label>

                    <div className="docs-grid">
                      <FileDropZone
                        label="Паспорт"
                        existingFiles={keepPassport}
                        files={newPassport}
                        maxFiles={MAX_PARENT_FILES}
                        onAdd={f => setNewPassport(p => [...p, ...f])}
                        onRemoveExisting={fn => setKeepPassport(p => p.filter(x => x !== fn))}
                        onRemoveNew={i => setNewPassport(p => p.filter((_, idx) => idx !== i))}
                      />
                      <FileDropZone
                        label="СНИЛС родителя"
                        existingFiles={keepSnils}
                        files={newSnils}
                        maxFiles={MAX_PARENT_FILES}
                        onAdd={f => setNewSnils(p => [...p, ...f])}
                        onRemoveExisting={fn => setKeepSnils(p => p.filter(x => x !== fn))}
                        onRemoveNew={i => setNewSnils(p => p.filter((_, idx) => idx !== i))}
                      />
                    </div>
                  </div>

                  <div className="profile__actions">
                    <button type="submit" className="profile__save" disabled={parentSaving}>
                      {parentSaving ? 'Сохранение...' : 'Сохранить документы'}
                    </button>
                    {parentProfile?.status && (
                      <button
                        type="button"
                        className="profile__delete-btn"
                        onClick={handleDeleteParentProfile}
                      >
                        Удалить документы
                      </button>
                    )}
                  </div>
                </form>

                {/* Children documents */}
                <div className="profile__card docs-card" style={{ marginTop: 24 }}>
                  <div className="profile__section">
                    <div className="docs-section-head">
                      <h2>Документы детей</h2>
                      <span className="docs-count">{children.length} / {MAX_CHILDREN}</span>
                    </div>
                    <p className="docs-hint">
                      Для каждого ребёнка загрузите ИППСУ, свидетельство о рождении и СНИЛС.
                      После проверки администрация привяжет ребёнка к вашему аккаунту.
                    </p>

                    {/* Existing children */}
                    {children.length > 0 && (
                      <div className="children-list">
                        {children.map(ch => {
                          const st = statusLabel[ch.status] || { text: ch.status, cls: '' }
                          const isEditing = editingChildId === ch.id
                          const canEdit   = ch.status === 'rejected'

                          if (isEditing) {
                            return (
                              <form key={ch.id} className="child-form child-form--edit" onSubmit={handleUpdateChild}>
                                <div className="profile__section">
                                  <div className="docs-section-head">
                                    <h3>Редактирование: {ch.child_name}</h3>
                                    <span className={`docs-status ${st.cls}`}>{st.text}</span>
                                  </div>
                                  {ch.admin_note && (
                                    <p className="child-card__note">
                                      Комментарий администратора: {ch.admin_note}
                                    </p>
                                  )}

                                  <label className="profile__field" style={{ maxWidth: 400 }}>
                                    <span>ФИО ребёнка *</span>
                                    <input
                                      value={editChildName}
                                      onChange={e => setEditChildName(e.target.value)}
                                    />
                                  </label>

                                  <p className="docs-small-hint">
                                    До {MAX_CHILD_FILES} файлов на тип, до {MAX_FILE_MB} МБ каждый. Суммарно не более 25 МБ.
                                  </p>

                                  <div className="docs-grid docs-grid--three">
                                    <FileDropZone
                                      label="ИППСУ *"
                                      existingFiles={editKeepIppsu}
                                      files={editNewIppsu}
                                      maxFiles={MAX_CHILD_FILES}
                                      onAdd={f => setEditNewIppsu(p => [...p, ...f])}
                                      onRemoveExisting={fn => setEditKeepIppsu(p => p.filter(x => x !== fn))}
                                      onRemoveNew={i => setEditNewIppsu(p => p.filter((_, idx) => idx !== i))}
                                    />
                                    <FileDropZone
                                      label="Свидетельство о рождении *"
                                      existingFiles={editKeepBirth}
                                      files={editNewBirth}
                                      maxFiles={MAX_CHILD_FILES}
                                      onAdd={f => setEditNewBirth(p => [...p, ...f])}
                                      onRemoveExisting={fn => setEditKeepBirth(p => p.filter(x => x !== fn))}
                                      onRemoveNew={i => setEditNewBirth(p => p.filter((_, idx) => idx !== i))}
                                    />
                                    <FileDropZone
                                      label="СНИЛС ребёнка *"
                                      existingFiles={editKeepSnils}
                                      files={editNewSnils}
                                      maxFiles={MAX_CHILD_FILES}
                                      onAdd={f => setEditNewSnils(p => [...p, ...f])}
                                      onRemoveExisting={fn => setEditKeepSnils(p => p.filter(x => x !== fn))}
                                      onRemoveNew={i => setEditNewSnils(p => p.filter((_, idx) => idx !== i))}
                                    />
                                  </div>
                                </div>

                                <div className="profile__actions child-form__actions">
                                  <button
                                    type="button"
                                    className="profile__save profile__save--ghost"
                                    onClick={cancelEditChild}
                                  >
                                    Отмена
                                  </button>
                                  <button type="submit" className="profile__save" disabled={editSaving}>
                                    {editSaving ? 'Отправка...' : 'Отправить повторно'}
                                  </button>
                                </div>
                              </form>
                            )
                          }

                          return (
                            <div key={ch.id} className="child-card">
                              <div className="child-card__header">
                                <span className="child-card__name">{ch.child_name}</span>
                                <span className={`docs-status ${st.cls}`}>{st.text}</span>
                              </div>
                              {ch.admin_note && (
                                <p className="child-card__note">
                                  Комментарий администратора: {ch.admin_note}
                                </p>
                              )}
                              <div className="child-card__files">
                                {[
                                  { label: 'ИППСУ', files: safeParseJSON(ch.ippsu_files) },
                                  { label: 'Свидетельство о рождении', files: safeParseJSON(ch.birth_cert_files) },
                                  { label: 'СНИЛС ребёнка', files: safeParseJSON(ch.child_snils_files) },
                                ].map(({ label, files }) => (
                                  <div key={label} className="child-card__filetype">
                                    <span>{label}:</span>
                                    {files.length === 0 ? (
                                      <span className="child-card__empty">не загружено</span>
                                    ) : (
                                      files.map(fn => (
                                        <a
                                          key={fn}
                                          href={documentService.fileUrl(fn)}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="child-card__filelink"
                                        >
                                          {fn}
                                        </a>
                                      ))
                                    )}
                                  </div>
                                ))}
                              </div>
                              <div className="child-card__actions">
                                {canEdit && (
                                  <button
                                    type="button"
                                    className="child-card__edit"
                                    onClick={() => openEditChild(ch)}
                                  >
                                    Редактировать
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="child-card__delete"
                                  onClick={() => handleDeleteChild(ch.id)}
                                >
                                  Удалить заявку
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Add child button */}
                    {canAddChild && !childFormOpen && (
                      <button
                        type="button"
                        className="child-add-btn"
                        onClick={() => setChildFormOpen(true)}
                      >
                        <span className="child-add-btn__icon">+</span>
                        Добавить документы ребёнка
                      </button>
                    )}

                    {!canAddChild && (
                      <p className="docs-hint docs-hint--warn">
                        Достигнут лимит: максимум {MAX_CHILDREN} детей.
                      </p>
                    )}
                  </div>

                  {/* Child add form */}
                  {childFormOpen && (
                    <form className="child-form" onSubmit={handleAddChild}>
                      <div className="profile__section">
                        <h3>Новый ребёнок</h3>
                        <label className="profile__field" style={{ maxWidth: 400 }}>
                          <span>ФИО ребёнка *</span>
                          <input
                            value={childName}
                            onChange={e => setChildName(e.target.value)}
                            placeholder="Иванов Иван Иванович"
                          />
                        </label>

                        <p className="docs-small-hint">
                          До {MAX_CHILD_FILES} файлов на тип, до {MAX_FILE_MB} МБ каждый.
                          Суммарно не более 25 МБ.
                        </p>

                        <div className="docs-grid docs-grid--three">
                          <FileDropZone
                            label="ИППСУ"
                            existingFiles={[]}
                            files={ippsuFiles}
                            maxFiles={MAX_CHILD_FILES}
                            onAdd={f => setIppsuFiles(p => [...p, ...f])}
                            onRemoveExisting={() => {}}
                            onRemoveNew={i => setIppsuFiles(p => p.filter((_, idx) => idx !== i))}
                          />
                          <FileDropZone
                            label="Свидетельство о рождении"
                            existingFiles={[]}
                            files={birthCertFiles}
                            maxFiles={MAX_CHILD_FILES}
                            onAdd={f => setBirthCertFiles(p => [...p, ...f])}
                            onRemoveExisting={() => {}}
                            onRemoveNew={i => setBirthCertFiles(p => p.filter((_, idx) => idx !== i))}
                          />
                          <FileDropZone
                            label="СНИЛС ребёнка"
                            existingFiles={[]}
                            files={childSnilsFiles}
                            maxFiles={MAX_CHILD_FILES}
                            onAdd={f => setChildSnilsFiles(p => [...p, ...f])}
                            onRemoveExisting={() => {}}
                            onRemoveNew={i => setChildSnilsFiles(p => p.filter((_, idx) => idx !== i))}
                          />
                        </div>
                      </div>

                      <div className="profile__actions child-form__actions">
                        <button
                          type="button"
                          className="profile__save profile__save--ghost"
                          onClick={() => {
                            setChildFormOpen(false)
                            setChildName('')
                            setIppsuFiles([])
                            setBirthCertFiles([])
                            setChildSnilsFiles([])
                          }}
                        >
                          Отмена
                        </button>
                        <label className="profile__ippsu-consent">
                          <input
                            type="checkbox"
                            checked={ippsuConsentGiven}
                            onChange={e => setIppsuConsentGiven(e.target.checked)}
                          />
                          <span>
                            Я даю явное согласие на обработку сведений о здоровье ребёнка
                            (документ ИППСУ) в соответствии со ст.&nbsp;10 Федерального закона
                            №&nbsp;152-ФЗ.{' '}
                            <a href="/privacy" target="_blank" rel="noopener noreferrer">
                              Политика обработки ПДн
                            </a>
                          </span>
                        </label>

                        <button type="submit" className="profile__save" disabled={childSaving}>
                          {childSaving ? 'Отправка...' : 'Отправить на проверку'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
                </>
                ) : (
                  <div className="profile__card" style={{ marginTop: 32, borderLeft: '4px solid #f7df00' }}>
                    <h2 style={{ color: '#074462', marginBottom: 12 }}>Подача документов</h2>
                    {qStatus === 'pending' ? (
                      <p style={{ color: '#55707f' }}>
                        ⏳ Ваша анкета находится на проверке у администратора. После одобрения здесь
                        появится форма для загрузки документов.
                      </p>
                    ) : qStatus === 'rejected' ? (
                      <p style={{ color: '#55707f' }}>
                        ⚠️ Анкета требует уточнения. После повторной отправки и одобрения администратором
                        вы сможете загрузить документы. Перейдите в{' '}
                        <a href="/dashboard" style={{ color: '#074462' }}>личный кабинет</a>.
                      </p>
                    ) : (
                      <p style={{ color: '#55707f' }}>
                        Подача документов будет доступна после того, как вы отправите и получите одобрение
                        входной анкеты. Перейдите в{' '}
                        <a href="/dashboard" style={{ color: '#074462' }}>личный кабинет</a>.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* ── Управление аккаунтом ── */}
        <section className="profile-danger-zone">
          <div className="container">
            <h2 className="profile-danger-zone__title">Управление аккаунтом</h2>
            <p className="profile-danger-zone__desc">
              Вы можете удалить свой аккаунт и все связанные персональные данные в соответствии
              с правом на стирание данных (ст.&nbsp;21 Федерального закона №&nbsp;152-ФЗ).
              Это действие <strong>необратимо</strong>: будут удалены все загруженные документы,
              анкеты и данные профиля.
            </p>

            {!deleteAccountOpen ? (
              <button
                className="profile-danger-zone__btn"
                onClick={() => setDeleteAccountOpen(true)}
              >
                Удалить аккаунт и все данные
              </button>
            ) : (
              <div className="profile-danger-zone__confirm">
                <p>Вы уверены? Это действие нельзя отменить.</p>
                <div className="profile-danger-zone__actions">
                  <button
                    className="profile-danger-zone__btn"
                    onClick={handleDeleteAccount}
                    disabled={deleteAccountLoading}
                  >
                    {deleteAccountLoading ? 'Удаление...' : 'Да, удалить всё'}
                  </button>
                  <button
                    className="profile-danger-zone__btn-cancel"
                    onClick={() => setDeleteAccountOpen(false)}
                    disabled={deleteAccountLoading}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

export default Profile
