import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Container,
	Paper,
	Typography,
	Button,
	Box,
	Grid,
	Card,
	CardContent,
	CardActions,
} from '@mui/material'
import {
	RateReview as ReviewIcon,
	AdminPanelSettings as AdminIcon,
	Logout as LogoutIcon,
	Newspaper as NewsIcon,
	Person as PersonIcon,
	CalendarMonth as ScheduleIcon,
	ChildCare as ChildIcon,
	Web as WebIcon,
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import authService from '../services/authService'
import scheduleService from '../services/scheduleService'
import NewsSection from '../components/NewsSection'

const Dashboard = ({ user, onLogout }) => {
				  useEffect(() => {
				  document.title = 'Обзор'
				}, [])
	const navigate = useNavigate()
	const [hasChildren, setHasChildren] = useState(false)

	useEffect(() => {
		scheduleService.getMyChildren()
			.then(data => setHasChildren(data.length > 0))
			.catch(() => {})
	}, [])

	const handleLogout = async () => {
		try {
			await authService.logout()
			onLogout()
			toast.success('Вы успешно вышли из системы')
			navigate('/login')
		} catch (error) {
			console.error('Logout error:', error)
			onLogout()
			navigate('/login')
		}
	}

	return (
		<Container maxWidth='lg' sx={{ mt: 4 }}>
			<Paper elevation={3} sx={{ p: 4 }}>
				<Box
					display='flex'
					justifyContent='space-between'
					alignItems='center'
					mb={4}
				>
					<Typography variant='h4'>
						Добро пожаловать, {user?.first_name}!
					</Typography>
					<Box display='flex' gap={2}>
						<Button
							variant='contained'
							color='primary'
							onClick={() =>
								window.open('http://localhost:3000/main', '_blank')
							}
							sx={{
								borderRadius: '12px',
								textTransform: 'none',
								fontWeight: 600,
							}}
						>
							Перейти на сайт
						</Button>

						<Button
							variant='outlined'
							startIcon={<PersonIcon />}
							onClick={() => navigate('/profile')}
						>
							Профиль
						</Button>

						<Button
							variant='outlined'
							color='error'
							startIcon={<LogoutIcon />}
							onClick={handleLogout}
						>
							Выйти
						</Button>
					</Box>
				</Box>

				{/* Секция новостей */}
				<NewsSection limit={3} />

				<Grid container spacing={3}>
					<Grid item xs={12} md={4}>
						<Card>
							<CardContent>
								<Box display='flex' alignItems='center' mb={2}>
									<NewsIcon sx={{ fontSize: 40, mr: 2, color: 'info.main' }} />
									<Typography variant='h5'>Новости</Typography>
								</Box>
								<Typography variant='body2' color='text.secondary'>
									Читайте последние новости и обновления
								</Typography>
							</CardContent>
							<CardActions>
								<Button
									size='small'
									variant='contained'
									color='info'
									onClick={() => navigate('/news')}
								>
									Все новости
								</Button>
							</CardActions>
						</Card>
					</Grid>

					<Grid item xs={12} md={4}>
						<Card>
							<CardContent>
								<Box display='flex' alignItems='center' mb={2}>
									<ReviewIcon
										sx={{ fontSize: 40, mr: 2, color: 'primary.main' }}
									/>
									<Typography variant='h5'>Отзывы</Typography>
								</Box>
								<Typography variant='body2' color='text.secondary'>
									Просмотрите отзывы других пользователей или оставьте свой
								</Typography>
							</CardContent>
							<CardActions>
								<Button
									size='small'
									variant='contained'
									onClick={() => navigate('/reviews')}
								>
									Перейти к отзывам
								</Button>
							</CardActions>
						</Card>
					</Grid>

					{(hasChildren || user?.role === 'teacher') && (
						<Grid item xs={12} md={4}>
							<Card>
								<CardContent>
									<Box display='flex' alignItems='center' mb={2}>
										<ChildIcon sx={{ fontSize: 40, mr: 2, color: 'success.main' }} />
										<Typography variant='h5'>Расписание</Typography>
									</Box>
									<Typography variant='body2' color='text.secondary'>
										{user?.role === 'teacher' ? 'Просмотр опубликованного расписания преподавателей и учеников' : 'Расписание занятий вашего ребёнка'}
									</Typography>
								</CardContent>
								<CardActions>
									<Button
										size='small'
										variant='contained'
										color='success'
										onClick={() => navigate('/my-schedule')}
									>
										Смотреть расписание
									</Button>
								</CardActions>
							</Card>
						</Grid>
					)}

					{user?.role === 'admin' && (
						<Grid item xs={12} md={4}>
							<Card>
								<CardContent>
									<Box display='flex' alignItems='center' mb={2}>
										<AdminIcon
											sx={{ fontSize: 40, mr: 2, color: 'secondary.main' }}
										/>
										<Typography variant='h5'>Администрирование</Typography>
									</Box>
									<Typography variant='body2' color='text.secondary'>
										Управление контентом и модерация
									</Typography>
								</CardContent>
								<CardActions>
									<Button
										size='small'
										variant='contained'
										color='secondary'
										onClick={() => navigate('/admin/reviews')}
									>
										Отзывы
									</Button>
								</CardActions>
							</Card>
						</Grid>
					)}

					{user?.role === 'admin' && (
						<Grid item xs={12} md={4}>
							<Card>
								<CardContent>
									<Box display='flex' alignItems='center' mb={2}>
										<ScheduleIcon
											sx={{ fontSize: 40, mr: 2, color: 'success.main' }}
										/>
										<Typography variant='h5'>Расписание</Typography>
									</Box>
									<Typography variant='body2' color='text.secondary'>
										Автоматическое формирование расписания занятий
									</Typography>
								</CardContent>
								<CardActions>
									<Button
										size='small'
										variant='contained'
										color='success'
										onClick={() => navigate('/admin/schedule')}
									>
										Открыть
									</Button>
								</CardActions>
							</Card>
						</Grid>
					)}

					{user?.role === 'admin' && (
						<Grid item xs={12} md={4}>
							<Card>
								<CardContent>
									<Box display='flex' alignItems='center' mb={2}>
										<WebIcon sx={{ fontSize: 40, mr: 2, color: 'info.main' }} />
										<Typography variant='h5'>Сайт</Typography>
									</Box>
									<Typography variant='body2' color='text.secondary'>
										Управление контентом публичных страниц
									</Typography>
								</CardContent>
								<CardActions>
									<Button
										size='small'
										variant='contained'
										color='info'
										onClick={() => navigate('/admin/cms')}
									>
										Открыть
									</Button>
								</CardActions>
							</Card>
						</Grid>
					)}
				</Grid>

				<Box mt={4}>
					<Typography variant='h6' gutterBottom>
						Информация о профиле
					</Typography>
					<Paper variant='outlined' sx={{ p: 2 }}>
						<Grid container spacing={2}>
							<Grid item xs={12} sm={6}>
								<Typography variant='body2' color='text.secondary'>
									Имя:
								</Typography>
								<Typography variant='body1'>
									{user?.first_name} {user?.middle_name} {user?.last_name}
								</Typography>
							</Grid>
							<Grid item xs={12} sm={6}>
								<Typography variant='body2' color='text.secondary'>
									Email:
								</Typography>
								<Typography variant='body1'>{user?.email}</Typography>
							</Grid>
							<Grid item xs={12} sm={6}>
								<Typography variant='body2' color='text.secondary'>
									Роль:
								</Typography>
								<Typography variant='body1'>
									{user?.role === 'admin' ? 'Администратор' : user?.role === 'teacher' ? 'Преподаватель' : 'Пользователь'}
								</Typography>
							</Grid>
						</Grid>
					</Paper>
				</Box>
			</Paper>
		</Container>
	)
}

export default Dashboard
