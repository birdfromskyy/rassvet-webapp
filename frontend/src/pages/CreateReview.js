import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Container,
	Paper,
	Typography,
	TextField,
	Button,
	Box,
	Rating,
	FormControlLabel,
	Checkbox,
	Alert,
	CircularProgress,
} from '@mui/material'
import { toast } from 'react-toastify'
import reviewService from '../services/reviewService'

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
			console.error('Error checking review:', error)
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

	if (checkingReview) {
		return (
			<Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
				<CircularProgress />
			</Container>
		)
	}

	return (
		<Container maxWidth='sm' sx={{ mt: 4 }}>
			<Paper elevation={3} sx={{ p: 4 }}>
				<Typography variant='h4' gutterBottom>
					{isEditMode ? 'Редактировать отзыв' : 'Написать отзыв'}
				</Typography>

				{existingReview?.status === 'pending' && (
					<Alert severity='info' sx={{ mb: 2 }}>
						Ваш отзыв находится на модерации
					</Alert>
				)}

				{existingReview?.status === 'approved' && (
					<Alert severity='warning' sx={{ mb: 2 }}>
						После редактирования отзыв будет отправлен на повторную модерацию
					</Alert>
				)}

				<Box component='form' onSubmit={handleSubmit} sx={{ mt: 3 }}>
					<Box mb={3}>
						<Typography component='legend' gutterBottom>
							Ваша оценка *
						</Typography>
						<Rating
							name='rating'
							value={formData.rating}
							onChange={(event, newValue) => {
								setFormData({ ...formData, rating: newValue })
							}}
							size='large'
						/>
						{errors.rating && (
							<Typography color='error' variant='caption'>
								{errors.rating}
							</Typography>
						)}
					</Box>

					<TextField
						fullWidth
						multiline
						rows={4}
						name='content'
						label='Текст отзыва *'
						value={formData.content}
						onChange={handleChange}
						error={!!errors.content}
						helperText={errors.content}
						sx={{ mb: 3 }}
					/>

					<FormControlLabel
						control={
							<Checkbox
								name='is_anonymous'
								checked={formData.is_anonymous}
								onChange={handleChange}
							/>
						}
						label='Сделать отзыв анонимным'
						sx={{ mb: 3 }}
					/>

					{!formData.is_anonymous && (
						<Alert severity='info' sx={{ mb: 3 }}>
							Ваш отзыв будет подписан: Имя и первая буква фамилии
						</Alert>
					)}

					<Box display='flex' gap={2}>
						<Button
							fullWidth
							variant='outlined'
							onClick={() => navigate('/reviews')}
						>
							Отмена
						</Button>
						<Button
							fullWidth
							variant='contained'
							type='submit'
							disabled={loading}
						>
							{loading
								? isEditMode
									? 'Обновление...'
									: 'Отправка...'
								: isEditMode
								? 'Обновить отзыв'
								: 'Отправить на модерацию'}
						</Button>
					</Box>
				</Box>
			</Paper>
		</Container>
	)
}

export default CreateReview
