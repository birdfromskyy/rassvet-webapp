import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Autocomplete,
	Box,
	Button,
	CircularProgress,
	Container,
	Paper,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	TextField,
	Typography,
} from '@mui/material'
import { ArrowBack as BackIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import scheduleService from '../services/scheduleService'

const pad = n => String(n).padStart(2, '0')
const isoDate = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const AdminReports = () => {
	const navigate = useNavigate()
	const today = new Date()
	const [teachers, setTeachers] = useState([])
	const [teacher, setTeacher] = useState(null)
	const [startDate, setStartDate] = useState(isoDate(new Date(today.getFullYear(), today.getMonth(), 1)))
	const [endDate, setEndDate] = useState(isoDate(today))
	const [report, setReport] = useState(null)
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		scheduleService.getTeachers()
			.then(data => setTeachers(data.filter(t => t.is_active)))
			.catch(() => toast.error('Ошибка загрузки преподавателей'))
	}, [])

	const loadReport = async () => {
		if (!teacher) {
			toast.error('Выберите преподавателя')
			return
		}
		setLoading(true)
		try {
			const data = await scheduleService.getTeacherReport(teacher.id, startDate, endDate)
			setReport(data)
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка загрузки отчёта')
		} finally {
			setLoading(false)
		}
	}

	const lessons = report?.lessons || []
	const counts = report?.duration_counts || { 30: 0, 50: 0, other: 0 }
	const teacherSummary = report?.teachers?.[0]

	return (
		<Container maxWidth='lg' sx={{ mt: 4 }}>
			<Paper elevation={3} sx={{ p: 4 }}>
				<Box display='flex' justifyContent='space-between' alignItems='center' mb={3}>
					<Box>
						<Typography variant='h5'>Отчётность преподавателя</Typography>
						<Typography variant='body2' color='text.secondary'>
							Учитываются только утверждённые расписания
						</Typography>
					</Box>
					<Button startIcon={<BackIcon />} onClick={() => navigate('/admin/schedule')}>
						Назад
					</Button>
				</Box>

				<Box display='grid' gridTemplateColumns={{ xs: '1fr', md: '2fr 1fr 1fr auto' }} gap={2} mb={3}>
					<Autocomplete
						options={teachers}
						value={teacher}
						getOptionLabel={t => t?.full_name || ''}
						onChange={(event, value) => setTeacher(value)}
						renderInput={params => <TextField {...params} label='Преподаватель' size='small' />}
					/>
					<TextField
						label='С'
						type='date'
						value={startDate}
						onChange={e => setStartDate(e.target.value)}
						size='small'
						InputLabelProps={{ shrink: true }}
					/>
					<TextField
						label='По'
						type='date'
						value={endDate}
						onChange={e => setEndDate(e.target.value)}
						size='small'
						InputLabelProps={{ shrink: true }}
					/>
					<Button variant='contained' onClick={loadReport} disabled={loading}>
						Показать
					</Button>
				</Box>

				{loading && <Box display='flex' justifyContent='center' my={4}><CircularProgress /></Box>}

				{!loading && report && (
					<>
						<Box display='flex' gap={2} flexWrap='wrap' mb={2}>
							<Typography>Всего занятий: <strong>{teacherSummary?.lessons || 0}</strong></Typography>
							<Typography>Часов: <strong>{(teacherSummary?.hours || 0).toFixed(1)}</strong></Typography>
							<Typography>30 минут: <strong>{counts['30'] || 0}</strong></Typography>
							<Typography>50 минут: <strong>{counts['50'] || 0}</strong></Typography>
							{Boolean(counts.other) && <Typography>Другая длительность: <strong>{counts.other}</strong></Typography>}
						</Box>

						<TableContainer>
							<Table size='small'>
								<TableHead>
									<TableRow>
										<TableCell>Дата</TableCell>
										<TableCell>Время</TableCell>
										<TableCell align='center'>Длительность</TableCell>
										<TableCell>Тип</TableCell>
										<TableCell>Ученик / группа</TableCell>
										<TableCell>Предмет</TableCell>
										<TableCell>Кабинет</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{lessons.map((lesson, index) => (
										<TableRow key={`${lesson.date}-${lesson.start_time}-${index}`}>
											<TableCell>{lesson.date}</TableCell>
											<TableCell>{lesson.start_time}-{lesson.end_time}</TableCell>
											<TableCell align='center'>{lesson.duration_min} мин</TableCell>
											<TableCell>{lesson.slot_type === 'group' ? 'Групповое' : 'Индивидуальное'}</TableCell>
											<TableCell>{lesson.slot_type === 'group' ? lesson.group_name : lesson.student_name}</TableCell>
											<TableCell>{lesson.subject_name}</TableCell>
											<TableCell>{lesson.room_name || '-'}</TableCell>
										</TableRow>
									))}
									{lessons.length === 0 && (
										<TableRow>
											<TableCell colSpan={7} align='center'>Нет занятий за выбранный период</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</TableContainer>
					</>
				)}
			</Paper>
		</Container>
	)
}

export default AdminReports
