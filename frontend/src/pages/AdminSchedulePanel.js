import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Container,
	Paper,
	Typography,
	Box,
	Button,
	Grid,
	Card,
	CardContent,
	CardActions,
} from '@mui/material'
import {
	MenuBook as SubjectIcon,
	Person as TeacherIcon,
	ChildCare as StudentIcon,
	MeetingRoom as RoomIcon,
	Assignment as AssignmentIcon,
	CalendarMonth as ScheduleIcon,
	Groups as GroupIcon,
	ArrowBack as BackIcon,
	ManageAccounts as UsersIcon,
} from '@mui/icons-material'

const MODULES = [
	{
		title: 'Предметы',
		description: 'Управление предметами и дисциплинами центра',
		icon: SubjectIcon,
		color: 'primary',
		path: '/admin/schedule/subjects',
	},
	{
		title: 'Преподаватели',
		description: 'Преподаватели, их предметы, кабинеты и рабочее время',
		icon: TeacherIcon,
		color: 'secondary',
		path: '/admin/schedule/teachers',
	},
	{
		title: 'Ученики',
		description: 'Ученики, их доступность и тип финансирования',
		icon: StudentIcon,
		color: 'info',
		path: '/admin/schedule/students',
	},
	{
		title: 'Кабинеты',
		description: 'Кабинеты и доступные в них предметы',
		icon: RoomIcon,
		color: 'success',
		path: '/admin/schedule/rooms',
	},
	{
		title: 'Назначения',
		description: 'Связки ученик — преподаватель — предмет',
		icon: AssignmentIcon,
		color: 'warning',
		path: '/admin/schedule/assignments',
	},
	{
		title: 'Групповые занятия',
		description: 'Группы учеников с общим преподавателем и предметом',
		icon: GroupIcon,
		color: 'secondary',
		path: '/admin/schedule/group-lessons',
	},
	{
		title: 'Расписание',
		description: 'Генерация и управление расписанием на неделю',
		icon: ScheduleIcon,
		color: 'error',
		path: '/admin/schedule/weekly',
	},
	{
		title: 'Пользователи',
		description: 'Привязка учеников к учётным записям родителей',
		icon: UsersIcon,
		color: 'primary',
		path: '/admin/users',
	},
]

const AdminSchedulePanel = () => {
	const navigate = useNavigate()

	return (
		<Container maxWidth='lg' sx={{ mt: 4 }}>
			<Paper elevation={3} sx={{ p: 4 }}>
				<Box
					display='flex'
					justifyContent='space-between'
					alignItems='center'
					mb={4}
				>
					<Box>
						<Typography variant='h4' gutterBottom>
							Модуль расписания
						</Typography>
						<Typography variant='body2' color='text.secondary'>
							Автоматическое формирование расписания занятий
						</Typography>
					</Box>
					<Button
						startIcon={<BackIcon />}
						onClick={() => navigate('/dashboard')}
					>
						На главную
					</Button>
				</Box>

				<Grid container spacing={3}>
					{MODULES.map(m => {
						const Icon = m.icon
						return (
							<Grid item xs={12} sm={6} md={4} key={m.path}>
								<Card
									sx={{
										height: '100%',
										display: 'flex',
										flexDirection: 'column',
									}}
								>
									<CardContent sx={{ flexGrow: 1 }}>
										<Box display='flex' alignItems='center' mb={1.5}>
											<Icon
												sx={{ fontSize: 36, mr: 2, color: `${m.color}.main` }}
											/>
											<Typography variant='h6'>{m.title}</Typography>
										</Box>
										<Typography variant='body2' color='text.secondary'>
											{m.description}
										</Typography>
									</CardContent>
									<CardActions>
										<Button
											size='small'
											variant='contained'
											color={m.color}
											onClick={() => navigate(m.path)}
										>
											Открыть
										</Button>
									</CardActions>
								</Card>
							</Grid>
						)
					})}
				</Grid>
			</Paper>
		</Container>
	)
}

export default AdminSchedulePanel
