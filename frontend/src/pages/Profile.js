import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Container,
	Paper,
	Typography,
	TextField,
	Button,
	Box,
	Alert,
	Grid,
	Divider,
} from '@mui/material'
import { ArrowBack, Save } from '@mui/icons-material'
import { toast } from 'react-toastify'
import authService from '../services/authService'

const Profile = ({ user, onUpdateUser, onLogout }) => {
	const navigate = useNavigate()
	const [formData, setFormData] = useState({
		first_name: '',
		last_name: '',
		middle_name: '',
		email: '',
		password: '',
		confirmPassword: '',
	})
	const [errors, setErrors] = useState({})
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		if (user) {
			setFormData({
				first_name: user.first_name || '',
				last_name: user.last_name || '',
				middle_name: user.middle_name || '',
				email: user.email || '',
				password: '',
				confirmPassword: '',
			})
		}
	}, [user])

	const handleChange = e => {
		setFormData({
			...formData,
			[e.target.name]: e.target.value,
		})

		if (errors[e.target.name]) {
			setErrors({
				...errors,
				[e.target.name]: '',
			})
		}
	}

	const validate = () => {
		const newErrors = {}

		if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
			newErrors.email = 'Email недействителен'
		}

		if (formData.password) {
			if (formData.password.length < 6) {
				newErrors.password = 'Пароль должен быть не менее 6 символов'
			}
			if (formData.password !== formData.confirmPassword) {
				newErrors.confirmPassword = 'Пароли не совпадают'
			}
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
			const dataToSend = {
				first_name: formData.first_name,
				last_name: formData.last_name,
				middle_name: formData.middle_name,
			}

			if (formData.email !== user?.email) {
				dataToSend.email = formData.email
			}

			if (formData.password) {
				dataToSend.password = formData.password
			}

			const response = await authService.updateProfile(dataToSend)

			if (response.emailChanged) {
				toast.info('Email изменен. Требуется повторная верификация')
				onLogout()

				setTimeout(() => {
					navigate('/verify-email', { state: { email: response.email } })
				}, 1500)

				return
			}

			onUpdateUser(response.user)
			toast.success('Профиль обновлен')
		} catch (error) {
			if (error.response?.status === 409) {
				setErrors({ email: 'Email уже используется' })
			} else {
				toast.error(error.response?.data?.error || 'Ошибка обновления профиля')
			}
		} finally {
			setLoading(false)
		}
	}

	return (
		<Container maxWidth='md' sx={{ mt: 4 }}>
			<Paper elevation={3} sx={{ p: 4 }}>
				<Box
					display='flex'
					justifyContent='space-between'
					alignItems='center'
					mb={3}
				>
					<Typography variant='h4'>Профиль</Typography>
					<Button
						startIcon={<ArrowBack />}
						onClick={() => navigate('/dashboard')}
					>
						На главную
					</Button>
				</Box>

				<Box component='form' onSubmit={handleSubmit}>
					<Grid container spacing={3}>
						<Grid item xs={12}>
							<Typography variant='h6' gutterBottom>
								Личные данные
							</Typography>
						</Grid>

						<Grid item xs={12} md={4}>
							<TextField
								fullWidth
								name='last_name'
								label='Фамилия'
								value={formData.last_name}
								onChange={handleChange}
							/>
						</Grid>

						<Grid item xs={12} md={4}>
							<TextField
								fullWidth
								name='first_name'
								label='Имя'
								value={formData.first_name}
								onChange={handleChange}
							/>
						</Grid>

						<Grid item xs={12} md={4}>
							<TextField
								fullWidth
								name='middle_name'
								label='Отчество'
								value={formData.middle_name}
								onChange={handleChange}
							/>
						</Grid>

						<Grid item xs={12}>
							<Divider />
						</Grid>

						<Grid item xs={12}>
							<Typography variant='h6' gutterBottom>
								Учетные данные
							</Typography>
						</Grid>

						<Grid item xs={12} md={6}>
							<TextField
								fullWidth
								name='email'
								label='Email'
								value={formData.email}
								onChange={handleChange}
								error={!!errors.email}
								helperText={
									errors.email ||
									'При смене email потребуется повторная верификация'
								}
							/>
						</Grid>

						<Grid item xs={12}>
							<Alert severity='info'>
								Оставьте поля паролей пустыми, если не хотите его менять
							</Alert>
						</Grid>

						<Grid item xs={12} md={6}>
							<TextField
								fullWidth
								type='password'
								name='password'
								label='Новый пароль'
								value={formData.password}
								onChange={handleChange}
								error={!!errors.password}
								helperText={errors.password}
							/>
						</Grid>

						<Grid item xs={12} md={6}>
							<TextField
								fullWidth
								type='password'
								name='confirmPassword'
								label='Подтвердите пароль'
								value={formData.confirmPassword}
								onChange={handleChange}
								error={!!errors.confirmPassword}
								helperText={errors.confirmPassword}
							/>
						</Grid>

						<Grid item xs={12}>
							<Button
								type='submit'
								variant='contained'
								startIcon={<Save />}
								disabled={loading}
								sx={{ mt: 2 }}
							>
								{loading ? 'Сохранение...' : 'Сохранить изменения'}
							</Button>
						</Grid>
					</Grid>
				</Box>
			</Paper>
		</Container>
	)
}

export default Profile
