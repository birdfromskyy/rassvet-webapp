import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
	Container,
	Paper,
	TextField,
	Button,
	Typography,
	Box,
	Alert,
} from '@mui/material'
import { toast } from 'react-toastify'
import authService from '../services/authService'

const Register = () => {
	const navigate = useNavigate()
	const [formData, setFormData] = useState({
		email: '',
		password: '',
		confirmPassword: '',
		first_name: '',
		last_name: '',
		middle_name: '',
	})
	const [errors, setErrors] = useState({})
	const [loading, setLoading] = useState(false)

	const handleChange = e => {
		setFormData({
			...formData,
			[e.target.name]: e.target.value,
		})
		// Clear error for this field
		if (errors[e.target.name]) {
			setErrors({
				...errors,
				[e.target.name]: '',
			})
		}
	}

	const validate = () => {
		const newErrors = {}

		if (!formData.email) {
			newErrors.email = 'Email обязателен'
		} else if (!/\S+@\S+\.\S+/.test(formData.email)) {
			newErrors.email = 'Email недействителен'
		}

		if (!formData.password) {
			newErrors.password = 'Пароль обязателен'
		} else if (formData.password.length < 6) {
			newErrors.password = 'Пароль должен быть не менее 6 символов'
		}

		if (formData.password !== formData.confirmPassword) {
			newErrors.confirmPassword = 'Пароли не совпадают'
		}

		if (!formData.first_name) {
			newErrors.first_name = 'Имя обязательно'
		}

		if (!formData.last_name) {
			newErrors.last_name = 'Фамилия обязательна'
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
			const { confirmPassword, ...dataToSend } = formData
			await authService.register(dataToSend)
			toast.success('Регистрация успешна! Проверьте email для подтверждения.')
			navigate('/verify-email', { state: { email: formData.email } })
		} catch (error) {
			if (error.response?.status === 409) {
				setErrors({ email: 'Пользователь с таким email уже существует' })
			} else {
				toast.error(error.response?.data?.error || 'Ошибка регистрации')
			}
		} finally {
			setLoading(false)
		}
	}

	return (
		<Container component='main' maxWidth='xs'>
			<Box
				sx={{
					marginTop: 4,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
				}}
			>
				<Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
					<Typography component='h1' variant='h5' align='center'>
						Регистрация
					</Typography>

					<Box component='form' onSubmit={handleSubmit} sx={{ mt: 1 }}>
						<TextField
							margin='normal'
							required
							fullWidth
							id='email'
							label='Email'
							name='email'
							autoComplete='email'
							value={formData.email}
							onChange={handleChange}
							error={!!errors.email}
							helperText={errors.email}
						/>
						<TextField
							margin='normal'
							required
							fullWidth
							id='first_name'
							label='Имя'
							name='first_name'
							value={formData.first_name}
							onChange={handleChange}
							error={!!errors.first_name}
							helperText={errors.first_name}
						/>
						<TextField
							margin='normal'
							required
							fullWidth
							id='last_name'
							label='Фамилия'
							name='last_name'
							value={formData.last_name}
							onChange={handleChange}
							error={!!errors.last_name}
							helperText={errors.last_name}
						/>
						<TextField
							margin='normal'
							fullWidth
							id='middle_name'
							label='Отчество'
							name='middle_name'
							value={formData.middle_name}
							onChange={handleChange}
						/>
						<TextField
							margin='normal'
							required
							fullWidth
							name='password'
							label='Пароль'
							type='password'
							id='password'
							value={formData.password}
							onChange={handleChange}
							error={!!errors.password}
							helperText={errors.password}
						/>
						<TextField
							margin='normal'
							required
							fullWidth
							name='confirmPassword'
							label='Подтвердите пароль'
							type='password'
							id='confirmPassword'
							value={formData.confirmPassword}
							onChange={handleChange}
							error={!!errors.confirmPassword}
							helperText={errors.confirmPassword}
						/>
						<Button
							type='submit'
							fullWidth
							variant='contained'
							sx={{ mt: 3, mb: 2 }}
							disabled={loading}
						>
							{loading ? 'Регистрация...' : 'Зарегистрироваться'}
						</Button>
						<Box textAlign='center'>
							<Link to='/login' style={{ textDecoration: 'none' }}>
								<Typography variant='body2' color='primary'>
									Уже есть аккаунт? Войти
								</Typography>
							</Link>
						</Box>
					</Box>
				</Paper>
			</Box>
		</Container>
	)
}

export default Register
