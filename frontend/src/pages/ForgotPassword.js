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
	Stepper,
	Step,
	StepLabel,
} from '@mui/material'
import { toast } from 'react-toastify'
import authService from '../services/authService'

const ForgotPassword = () => {
	const navigate = useNavigate()
	const [activeStep, setActiveStep] = useState(0)
	const [email, setEmail] = useState('')
	const [code, setCode] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')

	const steps = ['Введите email', 'Введите код', 'Получите новый пароль']

	const handleSendCode = async e => {
		e.preventDefault()
		setError('')
		setLoading(true)

		try {
			await authService.forgotPassword(email)
			toast.success('Код отправлен на email')
			setActiveStep(1)
		} catch (error) {
			setError(error.response?.data?.error || 'Ошибка отправки кода')
		} finally {
			setLoading(false)
		}
	}

	const handleResetPassword = async e => {
		e.preventDefault()
		setError('')
		setLoading(true)

		try {
			await authService.resetPassword(email, code)
			toast.success('Новый пароль отправлен на email!')
			setActiveStep(2)
			setTimeout(() => navigate('/login'), 3000)
		} catch (error) {
			if (error.response?.status === 429) {
				setError('Превышено количество попыток. Запросите новый код.')
			} else {
				setError(error.response?.data?.error || 'Неверный код')
			}
		} finally {
			setLoading(false)
		}
	}

	return (
		<Container component='main' maxWidth='xs'>
			<Box sx={{ marginTop: 8 }}>
				<Paper elevation={3} sx={{ padding: 4 }}>
					<Typography component='h1' variant='h5' align='center'>
						Восстановление пароля
					</Typography>

					<Stepper activeStep={activeStep} sx={{ mt: 3, mb: 3 }}>
						{steps.map(label => (
							<Step key={label}>
								<StepLabel>{label}</StepLabel>
							</Step>
						))}
					</Stepper>

					{error && (
						<Alert severity='error' sx={{ mb: 2 }}>
							{error}
						</Alert>
					)}

					{activeStep === 0 && (
						<Box component='form' onSubmit={handleSendCode}>
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
							<Button
								type='submit'
								fullWidth
								variant='contained'
								sx={{ mt: 3, mb: 2 }}
								disabled={loading}
							>
								{loading ? 'Отправка...' : 'Отправить код'}
							</Button>
						</Box>
					)}

					{activeStep === 1 && (
						<Box component='form' onSubmit={handleResetPassword}>
							<TextField
								margin='normal'
								required
								fullWidth
								id='code'
								label='Код из письма'
								name='code'
								value={code}
								onChange={e => setCode(e.target.value)}
								placeholder='000000'
							/>
							<Typography variant='caption' color='text.secondary'>
								У вас есть 5 попыток ввода кода
							</Typography>
							<Button
								type='submit'
								fullWidth
								variant='contained'
								sx={{ mt: 3, mb: 2 }}
								disabled={loading}
							>
								{loading ? 'Проверка...' : 'Сбросить пароль'}
							</Button>
						</Box>
					)}

					{activeStep === 2 && (
						<Alert severity='success'>
							Новый пароль отправлен на ваш email. Вы будете перенаправлены на
							страницу входа...
						</Alert>
					)}

					<Box textAlign='center'>
						<Link to='/login' style={{ textDecoration: 'none' }}>
							<Typography variant='body2' color='primary'>
								Вернуться к входу
							</Typography>
						</Link>
					</Box>
				</Paper>
			</Box>
		</Container>
	)
}

export default ForgotPassword
