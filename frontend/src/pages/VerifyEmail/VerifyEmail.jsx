import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import authService from '../../services/authService'
import './VerifyEmail.scss'

const VerifyEmail = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  const autoSentRef = useRef(false)

  useEffect(() => {
    document.title = 'РАСсвет | Подтверждение email'
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const emailFromQuery = params.get('email') || ''
    setEmail(emailFromQuery)
  }, [location.search])

  useEffect(() => {
    const autoSendCode = async () => {
      const params = new URLSearchParams(location.search)
      const emailFromQuery = params.get('email')
      const shouldAutoSend = params.get('autoSendCode') === '1'

      if (!emailFromQuery || !shouldAutoSend || autoSentRef.current) return

      autoSentRef.current = true
      setResending(true)
      setError('')

      try {
        await authService.resendCode(emailFromQuery)
        toast.success('Код подтверждения отправлен на почту')
      } catch (error) {
        setError(error.response?.data?.error || 'Ошибка автоматической отправки кода')
      } finally {
        setResending(false)
      }
    }

    autoSendCode()
  }, [location.search])

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await authService.verifyEmail({ email, code })
      toast.success('Email успешно подтвержден!')
      navigate('/login')
    } catch (error) {
      setError(error.response?.data?.error || 'Неверный код подтверждения')
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (!email) {
      setError('Введите email')
      return
    }

    setResending(true)
    setError('')

    try {
      await authService.resendCode(email)
      toast.success('Код отправлен повторно')
    } catch (error) {
      setError(error.response?.data?.error || 'Ошибка отправки кода')
    } finally {
      setResending(false)
    }
  }

  return (
    <main className="verify-page">
      <section className="verify">
        <div className="verify__card">

          <h1>Подтверждение Email</h1>

          <p className="verify__text">
            Введите код, отправленный на вашу почту, чтобы завершить регистрацию.
          </p>

          {resending && (
            <div className="verify__notice">
              Отправляем код подтверждения...
            </div>
          )}

          {error && (
            <div className="verify__notice verify__notice--error">
              {error}
            </div>
          )}

          <form className="verify__form" onSubmit={handleSubmit}>
            <label className="verify__field">
              <span>Email</span>

              <input
                required
                id="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@mail.ru"
              />
            </label>

            <label className="verify__field">
              <span>Код подтверждения</span>

              <input
                required
                id="code"
                name="code"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="000000"
              />
            </label>

            <div className="verify__actions">
              <button
                type="submit"
                className="verify__submit"
                disabled={loading}
              >
                {loading ? 'Проверка...' : 'Подтвердить'}
              </button>

              <button
                type="button"
                className="verify__repeat"
                onClick={handleResendCode}
                disabled={resending}
              >
                {resending ? 'Отправка...' : 'Отправить код повторно'}
              </button>
            </div>
          </form>

          <button
            type="button"
            className="verify__back"
            onClick={() => navigate('/login')}
          >
            Вернуться ко входу
          </button>
        </div>
      </section>
    </main>
  )
}

export default VerifyEmail