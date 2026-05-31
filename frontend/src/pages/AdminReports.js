import './AdminModule.scss'
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ExcelJS from 'exceljs'
import {
	Autocomplete,
	Box,
	Button,
	CircularProgress,
	Tab,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Tabs,
	TextField,
	Typography,
} from '@mui/material'
import { ArrowBack as BackIcon, TableChart as ExcelIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import scheduleService from '../services/scheduleService'

const ALL_OPTION = { id: '', full_name: 'Все' }
const pad = n => String(n).padStart(2, '0')
const isoDate = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const ruSort = (a = '', b = '') => String(a).localeCompare(String(b), 'ru')

const lessonTypeLabel = type => (type === 'group' ? 'Групповое' : 'Индивидуальное')
const lessonPersonLabel = lesson =>
	lesson.slot_type === 'group' ? lesson.group_name : lesson.student_name

// ─── Excel helpers ────────────────────────────────────────────────────────────
const reportColors = {
	titleBg: 'FF1A237E', sectionBg: 'FFE8EAF6', headerBg: 'FF283593',
	summaryBg: 'FFE8F0FE', lessonBg: 'FFFFFFFF', border: 'FF9E9E9E', white: 'FFFFFFFF',
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
const safeSheetName = (name, usedNames) => {
	const base = String(name || 'Лист').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Лист'
	let sheetName = base
	let i = 2
	while (usedNames.has(sheetName)) {
		const suffix = ` ${i}`
		sheetName = `${base.slice(0, 31 - suffix.length)}${suffix}`
		i++
	}
	usedNames.add(sheetName)
	return sheetName
}
const setupSheet = (ws, title, periodLabel, cols) => {
	ws.columns = cols
	const titleRow = ws.addRow([title])
	ws.mergeCells(`A${titleRow.number}:${String.fromCharCode(64 + cols.length)}${titleRow.number}`)
	titleRow.height = 26
	titleRow.getCell(1).font = { bold: true, size: 15, color: { argb: reportColors.white } }
	titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
	fillCell(titleRow.getCell(1), reportColors.titleBg)
	const periodRow = ws.addRow([periodLabel])
	ws.mergeCells(`A${periodRow.number}:${String.fromCharCode(64 + cols.length)}${periodRow.number}`)
	periodRow.getCell(1).font = { bold: true }
	periodRow.getCell(1).alignment = { horizontal: 'center' }
	ws.addRow([])
}
const addSectionTitle = (ws, title, colCount) => {
	const row = ws.addRow([title])
	ws.mergeCells(`A${row.number}:${String.fromCharCode(64 + colCount)}${row.number}`)
	row.getCell(1).font = { bold: true }
	row.getCell(1).alignment = { horizontal: 'center' }
	fillCell(row.getCell(1), reportColors.sectionBg)
}

// ─── Teacher Excel ─────────────────────────────────────────────────────────
const teacherCols = [
	{ width: 14 }, { width: 14 }, { width: 14 }, { width: 18 },
	{ width: 30 }, { width: 26 }, { width: 22 }, { width: 26 },
]
const addTeacherSummary = (ws, rows) => {
	addSectionTitle(ws, 'Итоги по предметам', 8)
	const header = ws.addRow(['Преподаватель', 'Предмет', 'Занятий', '30 мин', '50 мин', 'Часов'])
	styleHeaderRow(header)
	const totalRow = ws.addRow([
		'Всего', '',
		rows.reduce((s, r) => s + Number(r.lessons || 0), 0),
		rows.reduce((s, r) => s + Number(r.duration_30 || 0), 0),
		rows.reduce((s, r) => s + Number(r.duration_50 || 0), 0),
		rows.reduce((s, r) => s + Number(r.hours || 0), 0),
	])
	totalRow.font = { bold: true }
	totalRow.eachCell(cell => fillCell(cell, 'FFFFF3E0'))
	styleRowBorders(totalRow)
	rows.forEach(row => {
		const dr = ws.addRow([row.teacher_name, row.subject_name || '-', row.lessons || 0,
			row.duration_30 || 0, row.duration_50 || 0, Number(row.hours || 0)])
		dr.eachCell(cell => fillCell(cell, reportColors.summaryBg))
		styleRowBorders(dr)
	})
	ws.addRow([])
}
const addLessonsSection = (ws, lessons) => {
	addSectionTitle(ws, 'Занятия', 8)
	const header = ws.addRow(['Дата', 'Время', 'Длительность', 'Тип', 'Ученик / группа', 'Предмет', 'Кабинет', 'Преподаватель'])
	styleHeaderRow(header)
	lessons.forEach(lesson => {
		const dr = ws.addRow([
			lesson.date, `${lesson.start_time}-${lesson.end_time}`, `${lesson.duration_min} мин`,
			lessonTypeLabel(lesson.slot_type), lessonPersonLabel(lesson) || '-',
			lesson.subject_name || '-', lesson.room_name || '-', lesson.teacher_name || '-',
		])
		dr.eachCell(cell => fillCell(cell, reportColors.lessonBg))
		styleRowBorders(dr)
	})
}

// ─── Student Excel ─────────────────────────────────────────────────────────
const studentCols = [
	{ width: 28 }, { width: 28 }, { width: 14 }, { width: 14 }, { width: 14 },
	{ width: 14 }, { width: 26 }, { width: 22 }, { width: 26 },
]
const addStudentSummary = (ws, rows) => {
	addSectionTitle(ws, 'Итоги по предметам', 9)
	const header = ws.addRow(['Ученик', 'Предмет', 'Занятий', 'Длительность', 'Часов'])
	styleHeaderRow(header)
	const totalRow = ws.addRow([
		'Всего', '',
		rows.reduce((s, r) => s + Number(r.lessons || 0), 0), '',
		rows.reduce((s, r) => s + Number(r.hours || 0), 0),
	])
	totalRow.font = { bold: true }
	totalRow.eachCell(cell => fillCell(cell, 'FFFFF3E0'))
	styleRowBorders(totalRow)
	rows.forEach(row => {
		const dr = ws.addRow([
			row.student_name, row.subject_name || '-', row.lessons || 0,
			row.duration_min ? `${row.duration_min} мин` : '-', Number(row.hours || 0),
		])
		dr.eachCell(cell => fillCell(cell, reportColors.summaryBg))
		styleRowBorders(dr)
	})
	ws.addRow([])
}
const addStudentLessons = (ws, lessons) => {
	addSectionTitle(ws, 'Занятия', 9)
	const header = ws.addRow(['Дата', 'Время', 'Дл.', 'Тип', 'Ученик / группа', 'Предмет', 'Кабинет', 'Преподаватель'])
	styleHeaderRow(header)
	lessons.forEach(lesson => {
		const dr = ws.addRow([
			lesson.date, `${lesson.start_time}-${lesson.end_time}`, `${lesson.duration_min} мин`,
			lessonTypeLabel(lesson.slot_type), lessonPersonLabel(lesson) || '-',
			lesson.subject_name || '-', lesson.room_name || '-', lesson.teacher_name || '-',
		])
		dr.eachCell(cell => fillCell(cell, reportColors.lessonBg))
		styleRowBorders(dr)
	})
}

// ─── Component ────────────────────────────────────────────────────────────────
const AdminReports = () => {
	const navigate = useNavigate()
	const today = new Date()

	const [tab, setTab] = useState(0) // 0 = teachers, 1 = students
	const [teachers, setTeachers] = useState([])
	const [students, setStudents] = useState([])
	const [teacher, setTeacher] = useState(ALL_OPTION)
	const [student, setStudent] = useState(ALL_OPTION)
	const [startDate, setStartDate] = useState(isoDate(new Date(today.getFullYear(), today.getMonth(), 1)))
	const [endDate, setEndDate] = useState(isoDate(today))
	const [report, setReport] = useState(null)
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		Promise.all([scheduleService.getTeachers(), scheduleService.getStudents()])
			.then(([t, s]) => {
				setTeachers(t.filter(x => x.is_active))
				setStudents(s)
			})
			.catch(() => toast.error('Ошибка загрузки справочников'))
	}, [])

	// Reset report when tab changes
	const handleTabChange = (_, newTab) => {
		setTab(newTab)
		setReport(null)
	}

	const teacherRows = useMemo(
		() => [...(report?.teachers || [])].sort((a, b) =>
			ruSort(a.teacher_name, b.teacher_name) || ruSort(a.subject_name, b.subject_name)),
		[report],
	)
	const studentRows = useMemo(
		() => [...(report?.students || [])].sort((a, b) =>
			ruSort(a.student_name, b.student_name) || ruSort(a.subject_name, b.subject_name)),
		[report],
	)
	const lessons = useMemo(
		() => [...(report?.lessons || [])].sort((a, b) =>
			String(a.date || '').localeCompare(b.date || '') ||
			String(a.start_time || '').localeCompare(b.start_time || '') ||
			ruSort(a.teacher_name, b.teacher_name)),
		[report],
	)
	const counts = report?.duration_counts || {}

	const loadReport = async () => {
		setLoading(true)
		try {
			let data
			if (tab === 0) {
				data = await scheduleService.getTeacherReport(teacher?.id || null, startDate, endDate)
			} else {
				data = await scheduleService.getStudentReport(student?.id || null, startDate, endDate)
			}
			setReport(data)
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка загрузки отчёта')
		} finally {
			setLoading(false)
		}
	}

	const exportTeacherReport = async () => {
		if (!report) { toast.error('Сначала сформируйте отчёт'); return }
		const workbook = new ExcelJS.Workbook()
		workbook.creator = 'Rassvet'
		const periodLabel = `Период: ${startDate} — ${endDate}`
		const usedNames = new Set()

		const generalSheet = workbook.addWorksheet(safeSheetName('Общая', usedNames))
		setupSheet(generalSheet, 'Отчётность преподавателей', periodLabel, teacherCols)
		addTeacherSummary(generalSheet, teacherRows)
		addLessonsSection(generalSheet, lessons)

		const uniqueTeachers = [...new Set(teacherRows.map(r => r.teacher_name).filter(Boolean))].sort((a, b) => ruSort(a, b))
		uniqueTeachers.forEach(name => {
			const ws = workbook.addWorksheet(safeSheetName(name, usedNames))
			setupSheet(ws, name, periodLabel, teacherCols)
			addTeacherSummary(ws, teacherRows.filter(r => r.teacher_name === name))
			addLessonsSection(ws, lessons.filter(l => l.teacher_name === name))
		})
		workbook.eachSheet(ws => { ws.views = [{ state: 'frozen', ySplit: 4 }] })
		const buffer = await workbook.xlsx.writeBuffer()
		const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
		const a = document.createElement('a')
		a.href = url
		a.download = `Отчёт_преподаватели_${startDate}_${endDate}.xlsx`
		a.click()
		URL.revokeObjectURL(url)
	}

	const exportStudentReport = async () => {
		if (!report) { toast.error('Сначала сформируйте отчёт'); return }
		const workbook = new ExcelJS.Workbook()
		workbook.creator = 'Rassvet'
		const periodLabel = `Период: ${startDate} — ${endDate}`
		const usedNames = new Set()

		const generalSheet = workbook.addWorksheet(safeSheetName('Общая', usedNames))
		setupSheet(generalSheet, 'Отчётность по детям', periodLabel, studentCols)
		addStudentSummary(generalSheet, studentRows)
		addStudentLessons(generalSheet, lessons)

		const uniqueStudents = [...new Set(studentRows.map(r => r.student_name).filter(Boolean))].sort((a, b) => ruSort(a, b))
		uniqueStudents.forEach(name => {
			const ws = workbook.addWorksheet(safeSheetName(name, usedNames))
			setupSheet(ws, name, periodLabel, studentCols)
			addStudentSummary(ws, studentRows.filter(r => r.student_name === name))
			addStudentLessons(ws, lessons.filter(l => {
				const label = lessonPersonLabel(l) || ''
				return label.includes(name) || l.student_name === name
			}))
		})
		workbook.eachSheet(ws => { ws.views = [{ state: 'frozen', ySplit: 4 }] })
		const buffer = await workbook.xlsx.writeBuffer()
		const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
		const a = document.createElement('a')
		a.href = url
		a.download = `Отчёт_дети_${startDate}_${endDate}.xlsx`
		a.click()
		URL.revokeObjectURL(url)
	}

	const totalLessons = lessons.length
	const totalHours30 = counts['30'] || 0
	const totalHours50 = counts['50'] || 0

	return (
		<main className='admin-module'>
			<div className='admin-module__container'>
				<section className='admin-module__hero'>
					<div>
						<span className='admin-module__badge'>Расписание</span>
						<h1>Отчётность</h1>
						<p>Статистика занятий по преподавателям и детям за выбранный период. Учитываются только утверждённые расписания.</p>
					</div>
					<div className='admin-module__actions'>
						<Button startIcon={<BackIcon />} onClick={() => navigate('/admin/schedule')} className='admin-module__button admin-module__button--ghost'>
							Назад
						</Button>
					</div>
				</section>

				<section className='admin-module__panel'>

				<Tabs value={tab} onChange={handleTabChange} sx={{ mb: 2 }}>
					<Tab label='Преподаватели' />
					<Tab label='Дети' />
				</Tabs>

				<Box display='grid' gridTemplateColumns={{ xs: '1fr', md: '2fr 1fr 1fr auto auto' }} gap={2} mb={3}>
					{tab === 0 ? (
						<Autocomplete
							options={[ALL_OPTION, ...teachers]}
							value={teacher}
							getOptionLabel={t => t?.full_name || ''}
							onChange={(_, v) => setTeacher(v || ALL_OPTION)}
							renderInput={params => <TextField {...params} label='Преподаватель' size='small' />}
						/>
					) : (
						<Autocomplete
							options={[{ ...ALL_OPTION, full_name: 'Все дети' }, ...students]}
							value={student}
							getOptionLabel={s => s?.full_name || ''}
							onChange={(_, v) => setStudent(v || ALL_OPTION)}
							renderInput={params => <TextField {...params} label='Ребёнок' size='small' />}
						/>
					)}
					<TextField label='С' type='date' value={startDate} onChange={e => setStartDate(e.target.value)} size='small' InputLabelProps={{ shrink: true }} />
					<TextField label='По' type='date' value={endDate} onChange={e => setEndDate(e.target.value)} size='small' InputLabelProps={{ shrink: true }} />
					<Button variant='contained' onClick={loadReport} disabled={loading}>Показать</Button>
					<Button
						variant='outlined'
						startIcon={<ExcelIcon />}
						onClick={tab === 0 ? exportTeacherReport : exportStudentReport}
						disabled={!report}
					>
						Экспорт
					</Button>
				</Box>

				{loading && <Box display='flex' justifyContent='center' my={4}><CircularProgress /></Box>}

				{!loading && report && (
					<>
						<Box display='flex' gap={2} flexWrap='wrap' mb={2}>
							<Typography>Всего занятий: <strong>{totalLessons}</strong></Typography>
							{tab === 0 && <>
								<Typography>30 мин: <strong>{totalHours30}</strong></Typography>
								<Typography>50 мин: <strong>{totalHours50}</strong></Typography>
								{Boolean(counts.other) && <Typography>Другая длит.: <strong>{counts.other}</strong></Typography>}
							</>}
						</Box>

						{/* ─── Teachers tab ─── */}
						{tab === 0 && (
							<>
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
											{teacherRows.map(row => (
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
							</>
						)}

						{/* ─── Students tab ─── */}
						{tab === 1 && (
							<>
								<Typography variant='h6' sx={{ mb: 1 }}>Итоги по детям</Typography>
								<TableContainer sx={{ mb: 3 }}>
									<Table size='small'>
										<TableHead>
											<TableRow>
												<TableCell>Ребёнок</TableCell>
												<TableCell>Предмет</TableCell>
												<TableCell align='center'>Занятий</TableCell>
												<TableCell align='center'>Длительность</TableCell>
												<TableCell align='center'>Часов</TableCell>
											</TableRow>
										</TableHead>
										<TableBody>
											{studentRows.map((row, i) => (
												<TableRow key={`${row.student_id}-${row.subject_id}-${i}`}>
													<TableCell>{row.student_name}</TableCell>
													<TableCell>{row.subject_name || '-'}</TableCell>
													<TableCell align='center'>{row.lessons}</TableCell>
													<TableCell align='center'>{row.duration_min ? `${row.duration_min} мин` : '-'}</TableCell>
													<TableCell align='center'>{Number(row.hours || 0).toFixed(1)}</TableCell>
												</TableRow>
											))}
											{studentRows.length === 0 && (
												<TableRow>
													<TableCell colSpan={5} align='center'>Нет данных за период</TableCell>
												</TableRow>
											)}
										</TableBody>
									</Table>
								</TableContainer>
							</>
						)}

						{/* ─── Lessons list ─── */}
						<Typography variant='h6' sx={{ mb: 1 }}>Занятия</Typography>
						<TableContainer>
							<Table size='small'>
								<TableHead>
									<TableRow>
										<TableCell>Дата</TableCell>
										<TableCell>Время</TableCell>
										<TableCell align='center'>Длит.</TableCell>
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
											<TableCell>{lesson.start_time}–{lesson.end_time}</TableCell>
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
			</section>
		</div>
		</main>
	)
}

export default AdminReports
