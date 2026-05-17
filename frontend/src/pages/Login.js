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
import { useEffect } from 'react'

const Login = ({ onLogin }) => {
		  useEffect(() => {
		  document.title = 'Вход'
		}, [])
	const navigate = useNavigate()
	const [formData, setFormData] = useState({
		email: '',
		password: '',
	})
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

	const handleChange = e => {
		setFormData({
			...formData,
			[e.target.name]: e.target.value,
		})
	}

	const handleSubmit = async e => {
		e.preventDefault()
		setError('')
		setLoading(true)

		try {
			const response = await authService.login(formData)
			onLogin(response.token, response.user)
			toast.success('Вход выполнен успешно!')
			navigate('/dashboard')
		} catch (error) {
			if (error.response?.data?.error === 'Email not verified') {
				toast.error('Email не подтвержден. Проверьте почту.')
				navigate('/verify-email', { state: { email: formData.email } })
			} else {
				setError(error.response?.data?.error || 'Ошибка входа')
			}
		} finally {
			setLoading(false)
		}
	}

	return (
		<Container component='main' maxWidth='xs'>
			<Box
				sx={{
					marginTop: 8,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
				}}
			>
				<Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
					<Typography component='h1' variant='h5' align='center'>
						Вход в систему
					</Typography>
					{error && (
						<Alert severity='error' sx={{ mt: 2 }}>
							{error}
						</Alert>
					)}
					<Box component='form' onSubmit={handleSubmit} sx={{ mt: 1 }}>
						<TextField
							margin='normal'
							required
							fullWidth
							id='email'
							label='Email'
							name='email'
							autoComplete='email'
							autoFocus
							value={formData.email}
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
							autoComplete='current-password'
							value={formData.password}
							onChange={handleChange}
						/>
						<Button
							type='submit'
							fullWidth
							variant='contained'
							sx={{ mt: 3, mb: 2 }}
							disabled={loading}
						>
							{loading ? 'Вход...' : 'Войти'}
						</Button>
					</Box>
					<Box textAlign='center'>
						<Link to='/forgot-password' style={{ textDecoration: 'none' }}>
							<Typography variant='body2' color='primary' sx={{ mb: 1 }}>
								Забыли пароль?
							</Typography>
						</Link>
						<Link to='/register' style={{ textDecoration: 'none' }}>
							<Typography variant='body2' color='primary'>
								Нет аккаунта? Зарегистрироваться
							</Typography>
						</Link>
					</Box>
				</Paper>
			</Box>
		</Container>
	)
}

export default Login
