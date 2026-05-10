import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
		const params = new URLSearchParams(location.search)
		const emailFromQuery = params.get('email') || ''
		setEmail(emailFromQuery)
	}, [location.search])

	useEffect(() => {
		const autoSendCode = async () => {
			const params = new URLSearchParams(location.search)
			const emailFromQuery = params.get('email')
			const shouldAutoSend = params.get('autoSendCode') === '1'

			if (!emailFromQuery || !shouldAutoSend || autoSentRef.current) {
				return
			}

			autoSentRef.current = true
			setResending(true)
			setError('')

			try {
				await authService.resendCode(emailFromQuery)
				toast.success('Код подтверждения отправлен на почту')
			} catch (error) {
				setError(
					error.response?.data?.error || 'Ошибка автоматической отправки кода',
				)
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
						Подтверждение Email
					</Typography>

					<Typography variant='body2' align='center' sx={{ mt: 2 }}>
						Введите код, отправленный на вашу почту
					</Typography>

					{resending && (
						<Alert severity='info' sx={{ mt: 2 }}>
							Отправляем код подтверждения...
						</Alert>
					)}

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
							value={email}
							onChange={e => setEmail(e.target.value)}
						/>
						<TextField
							margin='normal'
							required
							fullWidth
							id='code'
							label='Код подтверждения'
							name='code'
							value={code}
							onChange={e => setCode(e.target.value)}
							placeholder='000000'
						/>
						<Button
							type='submit'
							fullWidth
							variant='contained'
							sx={{ mt: 3, mb: 2 }}
							disabled={loading}
						>
							{loading ? 'Проверка...' : 'Подтвердить'}
						</Button>
						<Button
							fullWidth
							variant='outlined'
							onClick={handleResendCode}
							disabled={resending}
						>
							{resending ? 'Отправка...' : 'Отправить код повторно'}
						</Button>
					</Box>
				</Paper>
			</Box>
		</Container>
	)
}

export default VerifyEmail
