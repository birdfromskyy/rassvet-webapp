import React, { useState } from 'react'
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
			await reviewService.createReview(formData)
			toast.success('Отзыв отправлен на модерацию!')
			navigate('/reviews')
		} catch (error) {
			toast.error(error.response?.data?.error || 'Ошибка при создании отзыва')
		} finally {
			setLoading(false)
		}
	}

	return (
		<Container maxWidth='sm' sx={{ mt: 4 }}>
			<Paper elevation={3} sx={{ p: 4 }}>
				<Typography variant='h4' gutterBottom>
					Написать отзыв
				</Typography>

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
							{loading ? 'Отправка...' : 'Отправить на модерацию'}
						</Button>
					</Box>
				</Box>
			</Paper>
		</Container>
	)
}

export default CreateReview
