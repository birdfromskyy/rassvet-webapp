import './AdminModule.scss'
import useBrandFont from '../hooks/useBrandFont'
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
// ISO "YYYY-MM-DD" → "DD.MM.YYYY" for display
const displayDate = iso => {
	const [y, m, d] = String(iso || '').split('-')
	return d && m && y ? `${d}.${m}.${y}` : (iso || '-')
}
const ruSort = (a = '', b = '') => String(a).localeCompare(String(b), 'ru')

const mergeReportPeople = (...lists) => {
	const byID = new Map()
	lists.flat().forEach(person => byID.set(person.id, person))
	return [...byID.values()].sort((a, b) => ruSort(a.full_name, b.full_name))
}

const reportPersonLabel = person => {
	if (!person) return ''
	if (!person.id) return person.full_name || ''
	if (person.archived_at) return `${person.full_name} — в архиве`
	if (!person.is_active) return `${person.full_name} — на паузе`
	return person.full_name || ''
}

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
	// The summary and lesson list share a sheet, so columns accommodate the
	// longest names used by either section.
	{ width: 36 }, { width: 42 }, { width: 18 }, { width: 20 },
	{ width: 34 }, { width: 38 }, { width: 22 }, { width: 44 },
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
			displayDate(lesson.date), `${lesson.start_time}-${lesson.end_time}`, `${lesson.duration_min} мин`,
			lessonTypeLabel(lesson.slot_type), lessonPersonLabel(lesson) || '-',
			lesson.subject_name || '-', lesson.room_name || '-', lesson.teacher_name || '-',
		])
		dr.eachCell(cell => fillCell(cell, reportColors.lessonBg))
		styleRowBorders(dr)
	})
}

// ─── Student Excel ─────────────────────────────────────────────────────────
const studentSummaryCols = [
	{ width: 10 }, { width: 32 }, { width: 42 }, { width: 14 },
	{ width: 18 }, { width: 16 }, { width: 18 },
]
const studentLessonCols = [
	{ width: 16 }, { width: 16 }, { width: 18 }, { width: 20 }, { width: 30 },
	{ width: 34 }, { width: 18 }, { width: 18 }, { width: 22 }, { width: 38 },
]
const addStudentSummary = (ws, rows) => {
	addSectionTitle(ws, 'Итоги по предметам', 7)
	const header = ws.addRow(['№ п/п', 'ФИО', 'Предмет', 'Занятий', 'Длительность', 'Тариф', 'Итого'])
	styleHeaderRow(header)
	const studentGroups = new Map()
	rows.forEach(row => {
		const existing = studentGroups.get(row.student_id)
		if (existing) {
			existing.rows.push(row)
		} else {
			studentGroups.set(row.student_id, { studentID: row.student_id, studentName: row.student_name, rows: [row] })
		}
	})
	const rowsByStudent = Array.from(studentGroups.values())

	rowsByStudent.forEach((student, index) => {
		const studentNumber = index + 1
		student.rows.forEach((row, rowIndex) => {
			const dr = ws.addRow([
				rowIndex === 0 ? studentNumber : '', rowIndex === 0 ? student.studentName : '', row.subject_name || '-', row.lessons || 0,
				row.duration_min ? `${row.duration_min} мин` : '-',
				Number(row.tariff_rub || 0), Number(row.amount_rub || 0),
			])
			dr.eachCell(cell => fillCell(cell, reportColors.summaryBg))
			styleRowBorders(dr)
		})

		// The numbered subtotal separates children visually and makes the
		// report usable without manually selecting each student's rows.
		if (index < rowsByStudent.length - 1) {
			const subtotalRow = ws.addRow([
				'', `Итого ${studentNumber}`, '',
				student.rows.reduce((sum, row) => sum + Number(row.lessons || 0), 0),
				'', '', student.rows.reduce((sum, row) => sum + Number(row.amount_rub || 0), 0),
			])
			subtotalRow.font = { bold: true }
			subtotalRow.eachCell(cell => fillCell(cell, 'FFF7F1E3'))
			styleRowBorders(subtotalRow)
		}
	})
	const totalRow = ws.addRow([
		'', 'Всего', '',
		rows.reduce((s, r) => s + Number(r.lessons || 0), 0),
		'', '', rows.reduce((s, r) => s + Number(r.amount_rub || 0), 0),
	])
	totalRow.font = { bold: true }
	totalRow.eachCell(cell => fillCell(cell, 'FFFFF3E0'))
	styleRowBorders(totalRow)
	ws.addRow([])
}
const addStudentLessons = (ws, lessons, forOneStudent = false) => {
	addSectionTitle(ws, 'Занятия', 10)
	const zeroAmountLessons = lessons.filter(lesson => Number(lesson.amount_rub || 0) === 0).length
	const zeroAmountRow = ws.addRow([`Занятий с суммой 0: ${zeroAmountLessons}`])
	ws.mergeCells(`A${zeroAmountRow.number}:J${zeroAmountRow.number}`)
	zeroAmountRow.getCell(1).font = { bold: true, color: { argb: 'FFC65D00' } }
	zeroAmountRow.getCell(1).alignment = { vertical: 'middle' }
	fillCell(zeroAmountRow.getCell(1), 'FFFFF3E0')
	styleRowBorders(zeroAmountRow)
	const header = ws.addRow(['Дата', 'Время', 'Длительность', 'Тип', 'Ученик / группа', 'Предмет', 'Тариф, руб.', 'Сумма, руб.', 'Кабинет', 'Преподаватель'])
	styleHeaderRow(header)
	lessons.forEach(lesson => {
		const dr = ws.addRow([
			displayDate(lesson.date), `${lesson.start_time}-${lesson.end_time}`, `${lesson.duration_min} мин`,
			lessonTypeLabel(lesson.slot_type), lessonPersonLabel(lesson) || '-',
			lesson.subject_name || '-', Number(lesson.tariff_rub || 0),
			Number(forOneStudent ? lesson.tariff_rub || 0 : lesson.amount_rub || 0),
			lesson.room_name || '-', lesson.teacher_name || '-',
		])
		dr.eachCell(cell => fillCell(cell, reportColors.lessonBg))
		styleRowBorders(dr)
	})
}

// ─── Component ────────────────────────────────────────────────────────────────
const AdminReports = () => {
  useBrandFont()
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
		// Reports are historical data, so the filters deliberately include
		// paused and archived people as well as active directory entries.
		Promise.all([
			scheduleService.getTeachers(),
			scheduleService.getTeachers({ archived: true }),
			scheduleService.getStudents(),
			scheduleService.getStudents({ archived: true }),
		])
			.then(([activeAndPausedTeachers, archivedTeachers, activeAndPausedStudents, archivedStudents]) => {
				setTeachers(mergeReportPeople(activeAndPausedTeachers, archivedTeachers))
				setStudents(mergeReportPeople(activeAndPausedStudents, archivedStudents))
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
	const totalAmountRub = Number(report?.total_amount_rub || 0)
	const studentSummary = useMemo(() => ({
		lessons: studentRows.reduce((sum, row) => sum + Number(row.lessons || 0), 0),
		hours: studentRows.reduce((sum, row) => sum + Number(row.hours || 0), 0),
		amount: studentRows.reduce((sum, row) => sum + Number(row.amount_rub || 0), 0),
	}), [studentRows])

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

		const uniqueTeachers = [...new Map(teacherRows.filter(row => row.teacher_id).map(row => [row.teacher_id, row.teacher_name])).entries()]
			.sort(([, left], [, right]) => ruSort(left, right))
		uniqueTeachers.forEach(([teacherId, name]) => {
			const ws = workbook.addWorksheet(safeSheetName(name, usedNames))
			setupSheet(ws, name, periodLabel, teacherCols)
			addTeacherSummary(ws, teacherRows.filter(row => row.teacher_id === teacherId))
			addLessonsSection(ws, lessons.filter(lesson => (lesson.teacher_ids || []).includes(teacherId)))
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

		const generalSheet = workbook.addWorksheet(safeSheetName('Общий — итоги', usedNames))
		setupSheet(generalSheet, 'Отчётность по детям', periodLabel, studentSummaryCols)
		addStudentSummary(generalSheet, studentRows)

		const lessonsSheet = workbook.addWorksheet(safeSheetName('Общий — занятия', usedNames))
		setupSheet(lessonsSheet, 'Отчётность по детям: все занятия', periodLabel, studentLessonCols)
		addStudentLessons(lessonsSheet, lessons)

		const studentsByID = new Map()
		studentRows.forEach(row => {
			if (row.student_id) studentsByID.set(row.student_id, row.student_name)
		})
		const uniqueStudents = [...studentsByID.entries()]
			.sort(([, a], [, b]) => ruSort(a, b))
		uniqueStudents.forEach(([studentID, name]) => {
			const ws = workbook.addWorksheet(safeSheetName(name, usedNames))
			setupSheet(ws, name, periodLabel, studentLessonCols)
			addStudentSummary(ws, studentRows.filter(r => r.student_id === studentID))
			addStudentLessons(ws, lessons.filter(l =>
				Array.isArray(l.student_ids) && l.student_ids.includes(studentID),
			), true)
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
					<Tab label='Сотрудники' />
					<Tab label='Ученики' />
				</Tabs>

				<Box display='grid' gridTemplateColumns={{ xs: '1fr', md: '2fr 1fr 1fr auto auto' }} gap={2} mb={3}>
					{tab === 0 ? (
						<Autocomplete
							options={[ALL_OPTION, ...teachers]}
							value={teacher}
							getOptionLabel={reportPersonLabel}
							onChange={(_, v) => setTeacher(v || ALL_OPTION)}
							renderInput={params => <TextField {...params} label='Преподаватель' size='small' />}
						/>
					) : (
						<Autocomplete
							options={[{ ...ALL_OPTION, full_name: 'Все дети' }, ...students]}
							value={student}
							getOptionLabel={reportPersonLabel}
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
							{tab === 1 && <Typography>Общая сумма: <strong>{new Intl.NumberFormat('ru-RU').format(totalAmountRub)} ₽</strong></Typography>}
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
								<Typography variant='h6' sx={{ mb: 1 }}>Итоги по предметам</Typography>
								<TableContainer sx={{ mb: 3 }}>
									<Table size='small'>
										<TableHead>
											<TableRow>
												<TableCell>Ребёнок</TableCell>
												<TableCell>Предмет</TableCell>
												<TableCell align='center'>Длительность</TableCell>
												<TableCell align='center'>Часов</TableCell>
												<TableCell align='center'>Занятий</TableCell>
												<TableCell align='center'>Тариф, руб.</TableCell>
												<TableCell align='right'>Сумма, руб.</TableCell>
											</TableRow>
										</TableHead>
										<TableBody>
											<TableRow>
												<TableCell colSpan={2}><strong>Всего</strong></TableCell>
												<TableCell align='center'>—</TableCell>
												<TableCell align='center'><strong>{studentSummary.hours.toFixed(1)}</strong></TableCell>
												<TableCell align='center'><strong>{studentSummary.lessons}</strong></TableCell>
												<TableCell align='center'>—</TableCell>
												<TableCell align='right'><strong>{new Intl.NumberFormat('ru-RU').format(studentSummary.amount)}</strong></TableCell>
											</TableRow>
											{studentRows.map((row, i) => (
												<TableRow key={`${row.student_id}-${row.subject_id}-${i}`}>
													<TableCell>{row.student_name}</TableCell>
													<TableCell>{row.subject_name || '-'}</TableCell>
													<TableCell align='center'>{row.duration_min ? `${row.duration_min} мин` : '-'}</TableCell>
													<TableCell align='center'>{Number(row.hours || 0).toFixed(1)}</TableCell>
													<TableCell align='center'>{row.lessons}</TableCell>
													<TableCell align='center'>{new Intl.NumberFormat('ru-RU').format(Number(row.tariff_rub || 0))}</TableCell>
													<TableCell align='right'>{new Intl.NumberFormat('ru-RU').format(Number(row.amount_rub || 0))}</TableCell>
												</TableRow>
											))}
											{studentRows.length === 0 && (
												<TableRow>
													<TableCell colSpan={7} align='center'>Нет данных за период</TableCell>
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
										<TableCell align='center'>Длительность</TableCell>
										<TableCell>Тип</TableCell>
										<TableCell>Ученик / группа</TableCell>
										<TableCell>Предмет</TableCell>
										{tab === 1 && <TableCell align='center'>Тариф, руб.</TableCell>}
										{tab === 1 && <TableCell align='right'>Сумма, руб.</TableCell>}
										<TableCell>Кабинет</TableCell>
										<TableCell>Преподаватель</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{lessons.map((lesson, index) => (
										<TableRow key={`${lesson.date}-${lesson.start_time}-${index}`}>
											<TableCell>{displayDate(lesson.date)}</TableCell>
											<TableCell>{lesson.start_time}–{lesson.end_time}</TableCell>
											<TableCell align='center'>{lesson.duration_min} мин</TableCell>
											<TableCell>{lessonTypeLabel(lesson.slot_type)}</TableCell>
											<TableCell>{lessonPersonLabel(lesson) || '-'}</TableCell>
											<TableCell>{lesson.subject_name || '-'}</TableCell>
											{tab === 1 && <TableCell align='center'>{new Intl.NumberFormat('ru-RU').format(Number(lesson.tariff_rub || 0))}</TableCell>}
											{tab === 1 && <TableCell align='right'>{new Intl.NumberFormat('ru-RU').format(Number(lesson.amount_rub || 0))}</TableCell>}
											<TableCell>{lesson.room_name || '-'}</TableCell>
											<TableCell>{lesson.teacher_name || ''}</TableCell>
										</TableRow>
									))}
									{lessons.length === 0 && (
										<TableRow>
											<TableCell colSpan={tab === 1 ? 10 : 8} align='center'>Нет занятий за выбранный период</TableCell>
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
