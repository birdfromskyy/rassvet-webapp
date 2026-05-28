import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import reviewService from '../../services/reviewService'
import './CreateReview.scss'

import Header from '../../components/Header/Header'
import Footer from '../../components/Footer/Footer'

const CreateReview = () => {
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    rating: 5,
    content: '',
    is_anonymous: false,
  })

  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [checkingReview, setCheckingReview] = useState(true)
  const [existingReview, setExistingReview] = useState(null)
  const [isEditMode, setIsEditMode] = useState(false)

  useEffect(() => {
    document.title = 'Отзыв'
    checkExistingReview()
  }, [])

  const checkExistingReview = async () => {
    try {
      const response = await reviewService.checkUserReview()

      if (response.hasReview && response.canEdit) {
        setExistingReview(response.review)
        setIsEditMode(true)
        setFormData({
          rating: response.review.rating,
          content: response.review.content,
          is_anonymous: response.review.is_anonymous,
        })
      } else if (response.hasReview && !response.canEdit) {
        toast.error('Ваш отзыв был отклонен модерацией')
        navigate('/reviews')
      }
    } catch (error) {
      console.error(error)
    } finally {
      setCheckingReview(false)
    }
  }

  const handleChange = e => {
    const { name, value, checked, type } = e.target

    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    })

    if (errors[name]) {
      setErrors({ ...errors, [name]: '' })
    }
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.content.trim()) {
      newErrors.content = 'Текст отзыва обязателен'
    } else if (formData.content.length < 10) {
      newErrors.content = 'Отзыв должен содержать минимум 10 символов'
    }

    if (!formData.rating || formData.rating < 1 || formData.rating > 5) {
      newErrors.rating = 'Выберите оценку от 1 до 5'
    }

    return newErrors
  }

  const handleSubmit = async e => {
    e.preventDefault()

    const newErrors = validate()
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)

    try {
      if (isEditMode) {
        await reviewService.updateMyReview(formData)
        toast.success('Отзыв обновлен и отправлен на модерацию!')
      } else {
        await reviewService.createReview(formData)
        toast.success('Отзыв отправлен на модерацию!')
      }

      navigate('/reviews')
    } catch (error) {
      if (error.response?.data?.hasReview) {
        toast.error(error.response.data.error)
        setTimeout(() => navigate('/reviews'), 2000)
      } else {
        toast.error(error.response?.data?.error || 'Ошибка при создании отзыва')
      }
    } finally {
      setLoading(false)
    }
  }

  const setRating = value => {
    setFormData({ ...formData, rating: value })

    if (errors.rating) {
      setErrors({ ...errors, rating: '' })
    }
  }

  if (checkingReview) {
    return (
      <main className="create-review-page">
        <div className="create-review__container">
          <div className="create-review__state">
            <h2>Проверяем ваш отзыв...</h2>
          </div>
        </div>
      </main>
    )
  }

  return (
	<>
	<Header />
    <main className="create-review-page">
      <section className="create-review__container container">
        <div className="create-review__hero">
          <span className="section-badge">Отзывы</span>

          <h1>
            {isEditMode ? 'Редактировать отзыв' : 'Написать отзыв'}
          </h1>

          <p>
            Поделитесь впечатлениями о работе центра. Ваш отзыв поможет другим
            родителям узнать больше о «РАСсвете».
          </p>
        </div>

        <form className="create-review__card" onSubmit={handleSubmit}>
          {existingReview?.status === 'pending' && (
			  <div className="create-review__notice">
              Ваш отзыв находится на модерации.
            </div>
          )}

          {existingReview?.status === 'approved' && (
			  <div className="create-review__notice create-review__notice--warning">
              После редактирования отзыв будет отправлен на повторную модерацию.
            </div>
          )}

          <div className="create-review__field">
            <div className="create-review__stars">
              {[1, 2, 3, 4, 5].map(value => (
				  <button
                  key={value}
                  type="button"
                  className={value <= formData.rating ? 'is-active' : ''}
                  onClick={() => setRating(value)}
				  >
                  ★
                </button>
              ))}
            </div>

            {errors.rating && <small>{errors.rating}</small>}
          </div>

          <label className="create-review__field">
            <textarea
              name="content"
              rows="6"
              value={formData.content}
              onChange={handleChange}
              className={errors.content ? 'is-error' : ''}
              placeholder="Расскажите о вашем опыте обращения в центр..."
			  />

            {errors.content && <small>{errors.content}</small>}
          </label>

          <label className="create-review__checkbox">
            <input
              type="checkbox"
              name="is_anonymous"
              checked={formData.is_anonymous}
              onChange={handleChange}
			  />

            <span>Сделать отзыв анонимным</span>
          </label>

          {!formData.is_anonymous && (
			  <div className="create-review__notice">
              Ваш отзыв будет подписан: имя и первая буква фамилии.
            </div>
          )}

          <div className="create-review__actions">
            <button
              type="button"
              className="create-review__cancel"
              onClick={() => navigate('/reviews')}
			  >
              Отмена
            </button>

            <button
              type="submit"
              className="create-review__submit"
              disabled={loading}
			  >
              {loading
                ? isEditMode
				? 'Обновление...'
				: 'Отправка...'
                : isEditMode
                ? 'Обновить отзыв'
                : 'Отправить на модерацию'}
            </button>
          </div>
        </form>
      </section>
    </main>
	<Footer />
	</>
  )
}

export default CreateReview