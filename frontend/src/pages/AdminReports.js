import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ExcelJS from 'exceljs'
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
import { ArrowBack as BackIcon, TableChart as ExcelIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import scheduleService from '../services/scheduleService'

const ALL_TEACHERS = { id: '', full_name: 'Все преподаватели' }
const pad = n => String(n).padStart(2, '0')
const isoDate = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const ruSort = (a = '', b = '') => String(a).localeCompare(String(b), 'ru')
const hoursFromCounts = counts => (counts['30'] || 0) * 0.5 + (counts['50'] || 0)

const sortReportRows = rows => [...rows].sort((a, b) => (
	ruSort(a.teacher_name, b.teacher_name) ||
	ruSort(a.subject_name, b.subject_name)
))

const sortLessons = rows => [...rows].sort((a, b) => (
	String(a.date || '').localeCompare(String(b.date || '')) ||
	String(a.start_time || '').localeCompare(String(b.start_time || '')) ||
	ruSort(a.teacher_name, b.teacher_name) ||
	ruSort(a.subject_name, b.subject_name)
))

const safeSheetName = (name, usedNames) => {
	const base = String(name || 'Преподаватель')
		.replace(/[\\/?*[\]:]/g, ' ')
		.trim()
		.slice(0, 31) || 'Преподаватель'
	let sheetName = base
	let index = 2
	while (usedNames.has(sheetName)) {
		const suffix = ` ${index}`
		sheetName = `${base.slice(0, 31 - suffix.length)}${suffix}`
		index += 1
	}
	usedNames.add(sheetName)
	return sheetName
}

const lessonTypeLabel = type => type === 'group' ? 'Групповое' : 'Индивидуальное'
const lessonPersonLabel = lesson => lesson.slot_type === 'group' ? lesson.group_name : lesson.student_name

const reportColors = {
	titleBg: 'FF1A237E',
	sectionBg: 'FFE8EAF6',
	headerBg: 'FF283593',
	summaryBg: 'FFE8F0FE',
	lessonBg: 'FFFFFFFF',
	border: 'FF9E9E9E',
	white: 'FFFFFFFF',
}

const fillCell = (cell, color) => {
	cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
}

const styleRowBorders = row => {
	row.eachCell(cell => {
		cell.border = {
			top: { style: 'thin', color: { argb: reportColors.border } },
			left: { style: 'thin', color: { argb: reportColors.border } },
			bottom: { style: 'thin', color: { argb: reportColors.border } },
			right: { style: 'thin', color: { argb: reportColors.border } },
		}
		cell.alignment = { vertical: 'middle', wrapText: true }
	})
}

const styleHeaderRow = row => {
	row.height = 22
	row.eachCell(cell => {
		cell.font = { bold: true, color: { argb: reportColors.white } }
		cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
		fillCell(cell, reportColors.headerBg)
	})
	styleRowBorders(row)
}

const setupSheet = (ws, title, periodLabel) => {
	ws.columns = [
		{ width: 14 }, { width: 14 }, { width: 14 }, { width: 18 },
		{ width: 30 }, { width: 26 }, { width: 22 }, { width: 26 },
	]

	const titleRow = ws.addRow([title])
	ws.mergeCells(`A${titleRow.number}:H${titleRow.number}`)
	titleRow.height = 26
	titleRow.getCell(1).font = { bold: true, size: 15, color: { argb: reportColors.white } }
	titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
	fillCell(titleRow.getCell(1), reportColors.titleBg)

	const periodRow = ws.addRow([periodLabel])
	ws.mergeCells(`A${periodRow.number}:H${periodRow.number}`)
	periodRow.getCell(1).font = { bold: true }
	periodRow.getCell(1).alignment = { horizontal: 'center' }

	ws.addRow([])
}

const addSectionTitle = (ws, title) => {
	const row = ws.addRow([title])
	ws.mergeCells(`A${row.number}:H${row.number}`)
	row.getCell(1).font = { bold: true }
	row.getCell(1).alignment = { horizontal: 'center' }
	fillCell(row.getCell(1), reportColors.sectionBg)
	return row
}

const addSummaryRows = (ws, rows) => {
	addSectionTitle(ws, 'Итоги по предметам')
	const header = ws.addRow(['Преподаватель', 'Предмет', 'Занятий', '30 мин', '50 мин', 'Часов'])
	styleHeaderRow(header)

	const totalRow = ws.addRow([
		'Всего',
		'',
		rows.reduce((sum, row) => sum + Number(row.lessons || 0), 0),
		rows.reduce((sum, row) => sum + Number(row.duration_30 || 0), 0),
		rows.reduce((sum, row) => sum + Number(row.duration_50 || 0), 0),
		rows.reduce((sum, row) => sum + Number(row.hours || 0), 0),
	])
	totalRow.font = { bold: true }
	totalRow.eachCell(cell => fillCell(cell, 'FFFFF3E0'))
	styleRowBorders(totalRow)

	rows.forEach(row => {
		const dataRow = ws.addRow([
			row.teacher_name,
			row.subject_name || '-',
			row.lessons || 0,
			row.duration_30 || 0,
			row.duration_50 || 0,
			Number(row.hours || 0),
		])
		dataRow.eachCell(cell => fillCell(cell, reportColors.summaryBg))
		styleRowBorders(dataRow)
	})

	ws.addRow([])
}

const addLessonRows = (ws, lessons) => {
	addSectionTitle(ws, 'Занятия')
	const header = ws.addRow(['Дата', 'Время', 'Длительность', 'Тип', 'Ученик / группа', 'Предмет', 'Кабинет', 'Преподаватель'])
	styleHeaderRow(header)

	lessons.forEach(lesson => {
		const dataRow = ws.addRow([
			lesson.date,
			`${lesson.start_time}-${lesson.end_time}`,
			`${lesson.duration_min} мин`,
			lessonTypeLabel(lesson.slot_type),
			lessonPersonLabel(lesson) || '-',
			lesson.subject_name || '-',
			lesson.room_name || '-',
			lesson.teacher_name || '-',
		])
		dataRow.eachCell(cell => fillCell(cell, reportColors.lessonBg))
		styleRowBorders(dataRow)
	})
}

const AdminReports = () => {
	const navigate = useNavigate()
	const today = new Date()
	const [teachers, setTeachers] = useState([])
	const [teacher, setTeacher] = useState(ALL_TEACHERS)
	const [startDate, setStartDate] = useState(isoDate(new Date(today.getFullYear(), today.getMonth(), 1)))
	const [endDate, setEndDate] = useState(isoDate(today))
	const [report, setReport] = useState(null)
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		scheduleService.getTeachers()
			.then(data => setTeachers(data.filter(t => t.is_active)))
			.catch(() => toast.error('Ошибка загрузки преподавателей'))
	}, [])

	const reportRows = useMemo(() => sortReportRows(report?.teachers || []), [report])
	const lessons = useMemo(() => sortLessons(report?.lessons || []), [report])
	const counts = report?.duration_counts || { 30: 0, 50: 0, other: 0 }
	const totalLessons = lessons.length
	const totalHours = hoursFromCounts(counts)

	const loadReport = async () => {
		setLoading(true)
		try {
			const data = await scheduleService.getTeacherReport(teacher?.id || null, startDate, endDate)
			setReport(data)
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка загрузки отчёта')
		} finally {
			setLoading(false)
		}
	}

	const exportReport = async () => {
		if (!report) {
			toast.error('Сначала сформируйте отчёт')
			return
		}

		const workbook = new ExcelJS.Workbook()
		workbook.creator = 'Rassvet'
		const periodLabel = `Период: ${startDate} - ${endDate}`
		const usedSheetNames = new Set()

		const generalSheet = workbook.addWorksheet(safeSheetName('Общая отчётность', usedSheetNames))
		setupSheet(generalSheet, 'Общая отчётность преподавателей', periodLabel)
		addSummaryRows(generalSheet, reportRows)
		addLessonRows(generalSheet, lessons)

		const teachersInReport = [...new Set(reportRows.map(row => row.teacher_name).filter(Boolean))]
			.sort((a, b) => ruSort(a, b))

		teachersInReport.forEach(teacherName => {
			const teacherRows = reportRows.filter(row => row.teacher_name === teacherName)
			const teacherLessons = lessons.filter(lesson => lesson.teacher_name === teacherName)
			const ws = workbook.addWorksheet(safeSheetName(teacherName, usedSheetNames))
			setupSheet(ws, teacherName, periodLabel)
			addSummaryRows(ws, teacherRows)
			addLessonRows(ws, teacherLessons)
		})

		workbook.eachSheet(ws => {
			ws.views = [{ state: 'frozen', ySplit: 4 }]
		})

		const buffer = await workbook.xlsx.writeBuffer()
		const blob = new Blob([buffer], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		})
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `Отчётность_${startDate}_${endDate}.xlsx`
		a.click()
		URL.revokeObjectURL(url)
	}

	return (
		<Container maxWidth='lg' sx={{ mt: 4 }}>
			<Paper elevation={3} sx={{ p: 4 }}>
				<Box display='flex' justifyContent='space-between' alignItems='center' mb={3}>
					<Box>
						<Typography variant='h5'>Отчётность преподавателей</Typography>
						<Typography variant='body2' color='text.secondary'>
							Учитываются только утверждённые расписания
						</Typography>
					</Box>
					<Button startIcon={<BackIcon />} onClick={() => navigate('/admin/schedule')}>
						Назад
					</Button>
				</Box>

				<Box display='grid' gridTemplateColumns={{ xs: '1fr', md: '2fr 1fr 1fr auto auto' }} gap={2} mb={3}>
					<Autocomplete
						options={[ALL_TEACHERS, ...teachers]}
						value={teacher}
						getOptionLabel={t => t?.full_name || ''}
						onChange={(event, value) => setTeacher(value || ALL_TEACHERS)}
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
					<Button variant='outlined' startIcon={<ExcelIcon />} onClick={exportReport} disabled={!report}>
						Экспорт
					</Button>
				</Box>

				{loading && <Box display='flex' justifyContent='center' my={4}><CircularProgress /></Box>}

				{!loading && report && (
					<>
						<Box display='flex' gap={2} flexWrap='wrap' mb={2}>
							<Typography>Всего занятий: <strong>{totalLessons}</strong></Typography>
							<Typography>Часов: <strong>{totalHours.toFixed(1)}</strong></Typography>
							<Typography>30 минут: <strong>{counts['30'] || 0}</strong></Typography>
							<Typography>50 минут: <strong>{counts['50'] || 0}</strong></Typography>
							{Boolean(counts.other) && <Typography>Другая длительность: <strong>{counts.other}</strong></Typography>}
						</Box>

						<Typography variant='h6' sx={{ mb: 1 }}>Итоги по предметам</Typography>
						<TableContainer sx={{ mb: 3 }}>
							<Table size='small'>
								<TableHead>
									<TableRow>
										<TableCell>Преподаватель</TableCell>
										<TableCell>Предмет</TableCell>
										<TableCell align='center'>Занятий</TableCell>
										<TableCell align='center'>30 мин</TableCell>
										<TableCell align='center'>50 мин</TableCell>
										<TableCell align='center'>Часов</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{reportRows.map(row => (
										<TableRow key={`${row.teacher_id}-${row.subject_id}`}>
											<TableCell>{row.teacher_name}</TableCell>
											<TableCell>{row.subject_name || '-'}</TableCell>
											<TableCell align='center'>{row.lessons}</TableCell>
											<TableCell align='center'>{row.duration_30 || 0}</TableCell>
											<TableCell align='center'>{row.duration_50 || 0}</TableCell>
											<TableCell align='center'>{Number(row.hours || 0).toFixed(1)}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</TableContainer>

						<Typography variant='h6' sx={{ mb: 1 }}>Занятия</Typography>
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
										<TableCell>Преподаватель</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{lessons.map((lesson, index) => (
										<TableRow key={`${lesson.date}-${lesson.start_time}-${index}`}>
											<TableCell>{lesson.date}</TableCell>
											<TableCell>{lesson.start_time}-{lesson.end_time}</TableCell>
											<TableCell align='center'>{lesson.duration_min} мин</TableCell>
											<TableCell>{lessonTypeLabel(lesson.slot_type)}</TableCell>
											<TableCell>{lessonPersonLabel(lesson) || '-'}</TableCell>
											<TableCell>{lesson.subject_name || '-'}</TableCell>
											<TableCell>{lesson.room_name || '-'}</TableCell>
											<TableCell>{lesson.teacher_name || ''}</TableCell>
										</TableRow>
									))}
									{lessons.length === 0 && (
										<TableRow>
											<TableCell colSpan={8} align='center'>Нет занятий за выбранный период</TableCell>
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
