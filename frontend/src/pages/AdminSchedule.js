import React, { useState, useEffect, useCallback, useRef } from 'react'
import ExcelJS from 'exceljs'
import { useNavigate } from 'react-router-dom'
import {
	Container,
	Paper,
	Typography,
	Box,
	Button,
	Chip,
	CircularProgress,
	LinearProgress,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	IconButton,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	TextField,
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	Accordion,
	AccordionSummary,
	AccordionDetails,
	Grid,
	Alert,
	Tooltip,
	Divider,
	List,
	ListItem,
	ListItemText,
	ListItemSecondaryAction,
	TableSortLabel,
	Checkbox,
	FormControlLabel,
	Autocomplete,
} from '@mui/material'
import {
	ArrowBack as BackIcon,
	ChevronLeft,
	ChevronRight,
	Add as AddIcon,
	Edit as EditIcon,
	Delete as DeleteIcon,
	CheckCircle as ApproveIcon,
	CheckCircleOutline as ConductedIcon,
	Cancel as UnapproveIcon,
	CancelOutlined as CancelSlotIcon,
	Refresh as ResetIcon,
	AutoAwesome as GenerateIcon,
	ExpandMore as ExpandIcon,
	PersonOff as ExcludeIcon,
	PersonAdd as IncludeIcon,
	ClearAll as ClearIcon,
	TableChart as ExcelIcon,
	Lock as LockIcon,
	LockOpen as LockOpenIcon,
	Schedule as ScheduledIcon,
	PeopleAlt as AttendanceIcon,
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import scheduleService from '../services/scheduleService'

const WEEKDAY_NAMES = {
	1: 'Понедельник',
	2: 'Вторник',
	3: 'Среда',
	4: 'Четверг',
	5: 'Пятница',
	6: 'Суббота',
	7: 'Воскресенье',
}

const STATUS_COLORS = {
	draft: 'warning',
	approved: 'success',
	archived: 'default',
}
const STATUS_LABELS = {
	draft: 'Черновик',
	approved: 'Утверждено',
	archived: 'Архив',
}
const SLOT_STATUS_COLORS = {
	scheduled: 'default',
	conducted: 'success',
	moved: 'warning',
	cancelled: 'error',
}
const SLOT_STATUS_LABELS = {
	scheduled: 'Запланировано',
	conducted: 'Проведено',
	moved: 'Перенесено',
	cancelled: 'Отменено',
}

const EMPTY_SLOT_FORM = {
	slot_type: 'individual',
	assignment_id: '',
	group_lesson_id: '',
	student_id: '',
	teacher_id: '',
	subject_id: '',
	room_id: '',
	room_name: '',
	weekday: 1,
	start_time: '09:00',
	end_time: '09:50',
}

const EMPTY_EDIT_FORM = {
	weekday: 1,
	start_time: '09:00',
	end_time: '09:50',
	room_id: '',
	status: 'scheduled',
}

// Row background colors: green=group, red=paid individual, blue=budget individual
const getSlotBgColor = slot => {
	if (slot.slot_type === 'group') return 'rgba(76,175,80,0.10)'
	if (slot.assignment?.funding_type === 'paid') return 'rgba(244,67,54,0.10)'
	return 'rgba(33,150,243,0.10)'
}

const getMonday = date => {
	const d = new Date(date)
	const day = d.getDay()
	const diff = day === 0 ? -6 : 1 - day
	d.setDate(d.getDate() + diff)
	d.setHours(0, 0, 0, 0)
	return d
}

const formatDateISO = date => date.toISOString().split('T')[0]

const getSlotDuration = slot => {
	const [startH, startM] = slot.start_time.split(':').map(Number)
	const [endH, endM] = slot.end_time.split(':').map(Number)
	return endH * 60 + endM - (startH * 60 + startM)
}

const formatWeekLabel = weekStart => {
	const weekEnd = new Date(weekStart)
	weekEnd.setDate(weekEnd.getDate() + 6)
	const opts = { day: 'numeric', month: 'long' }
	return `${weekStart.toLocaleDateString('ru-RU', opts)} — ${weekEnd.toLocaleDateString('ru-RU', { ...opts, year: 'numeric' })}`
}

const getWeekdayDate = (weekStart, day) => {
	const d = new Date(weekStart)
	d.setDate(d.getDate() + day - 1)
	return d
}

const AdminSchedule = () => {
	const navigate = useNavigate()
	const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
	const [scheduleData, setScheduleData] = useState(null)
	const [loading, setLoading] = useState(false)
	const [generating, setGenerating] = useState(false)
	const [generationProgress, setGenerationProgress] = useState(null)
	const [pastWeekConfirm, setPastWeekConfirm] = useState({ open: false, message: '' })
	const [pastWeekCountdown, setPastWeekCountdown] = useState(0)
	const pendingPastWeekAction = useRef(null)
	const [attendanceDialog, setAttendanceDialog] = useState({ open: false, slot: null })

	// Reference data for dialogs and filters
	const [assignments, setAssignments] = useState([])
	const [groupLessons, setGroupLessons] = useState([])
	const [rooms, setRooms] = useState([])
	const [subjects, setSubjects] = useState([])
	const [students, setStudents] = useState([])
	const [teachers, setTeachers] = useState([])
	const [refLoaded, setRefLoaded] = useState(false)

	// Slot filters
	const [filterStudentId, setFilterStudentId] = useState('')
	const [filterTeacherId, setFilterTeacherId] = useState('')
	const [filterRoomId, setFilterRoomId] = useState('')
	const [filterFundingType, setFilterFundingType] = useState('')

	// Issue filters
	const [filterIssueStudentId, setFilterIssueStudentId] = useState('')
	const [filterIssueTeacherId, setFilterIssueTeacherId] = useState('')
	const [filterIssueFundingType, setFilterIssueFundingType] = useState('')

	// Issue sorting
	const [issueSortBy, setIssueSortBy] = useState('student')
	const [issueSortDir, setIssueSortDir] = useState('asc')

	// Create slot dialog
	const [createDialog, setCreateDialog] = useState(false)
	const [slotForm, setSlotForm] = useState(EMPTY_SLOT_FORM)

	// Edit slot dialog
	const [editDialog, setEditDialog] = useState({ open: false, slot: null })
	const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM)
	const [addGroupStudentId, setAddGroupStudentId] = useState('')

	// Conflict warning dialog
	const [conflictDialog, setConflictDialog] = useState({ open: false, conflicts: [], deleteConflicts: true })
	const pendingSlotAction = useRef(null)

	// Approve-blocking conflict dialog
	const [approveConflictDialog, setApproveConflictDialog] = useState({ open: false, pairs: [] })

	// Delete manual slots confirmation dialog
	const [deleteManualDialog, setDeleteManualDialog] = useState({ open: false, countdown: 5 })
	const deleteManualTimerRef = useRef(null)

	const weekStartISO = formatDateISO(weekStart)

	const loadSchedule = useCallback(async () => {
		setLoading(true)
		try {
			const data = await scheduleService.getScheduleByWeek(weekStartISO)
			setScheduleData(data)
		} catch (e) {
			if (e.response?.status === 404) {
				setScheduleData(null)
			} else {
				toast.error('Ошибка загрузки расписания')
			}
		} finally {
			setLoading(false)
		}
	}, [weekStartISO])

	useEffect(() => {
		loadSchedule()
	}, [loadSchedule])

	// Load reference data once
	useEffect(() => {
		if (refLoaded) return
		Promise.all([
			scheduleService.getAssignments({ status: 'active' }),
			scheduleService.getGroupLessons({ status: 'active' }),
			scheduleService.getRooms(),
			scheduleService.getSubjects(),
			scheduleService.getStudents(),
			scheduleService.getTeachers(),
		])
			.then(([aData, gData, rData, subjData, sData, tData]) => {
				setAssignments(aData)
				setGroupLessons(gData)
				setRooms(rData.filter(r => r.is_active))
				setSubjects(subjData.filter(s => s.is_active))
				setStudents(sData)
				setTeachers(tData)
				setRefLoaded(true)
			})
			.catch(() => toast.error('Ошибка загрузки справочников'))
	}, [refLoaded])

	const prevWeek = () =>
		setWeekStart(d => {
			const n = new Date(d)
			n.setDate(n.getDate() - 7)
			return n
		})

	const nextWeek = () =>
		setWeekStart(d => {
			const n = new Date(d)
			n.setDate(n.getDate() + 7)
			return n
		})

	const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

	const pollGenerationJob = async (jobId, successMessage) => {
		let currentJob = null
		while (true) {
			await wait(1500)
			currentJob = await scheduleService.getGenerationJob(jobId)
			setGenerationProgress(currentJob)

			if (currentJob.status === 'completed') {
				if (currentJob.result) setScheduleData(currentJob.result)
				toast.success(successMessage)
				return
			}

			if (currentJob.status === 'failed') {
				throw new Error(currentJob.error || 'Ошибка генерации')
			}
		}
	}

	const currentMonday = getMonday(new Date())
	const isPastWeek = weekStart < currentMonday
	const isCurrentWeek = weekStart.getTime() === currentMonday.getTime()

	const openPastWeekConfirm = (message, action) => {
		pendingPastWeekAction.current = action
		setPastWeekCountdown(5)
		setPastWeekConfirm({ open: true, message })
		const timer = setInterval(() => {
			setPastWeekCountdown(prev => {
				if (prev <= 1) { clearInterval(timer); return 0 }
				return prev - 1
			})
		}, 1000)
	}

	const confirmPastWeekAction = () => {
		setPastWeekConfirm({ open: false, message: '' })
		if (pendingPastWeekAction.current) {
			pendingPastWeekAction.current()
			pendingPastWeekAction.current = null
		}
	}

	const doGenerate = async () => {
		setGenerating(true)
		setGenerationProgress({ percent: 0, message: 'Запуск генерации...' })
		try {
			const job = await scheduleService.startGenerateSchedule(weekStartISO)
			setGenerationProgress(job)
			await pollGenerationJob(job.id, 'Расписание сгенерировано')
		} catch (e) {
			toast.error(e.response?.data?.error || e.message || 'Ошибка генерации')
		} finally {
			setGenerating(false)
			setGenerationProgress(null)
		}
	}

	const generate = () => {
		if (isPastWeek) {
			openPastWeekConfirm(
				`Сгенерировать расписание на прошедшую неделю ${formatWeekLabel(weekStart)}? Авто-слоты будут пересозданы.`,
				doGenerate,
			)
		} else {
			doGenerate()
		}
	}

	const markSlotStatus = async (slot, newStatus) => {
		try {
			await scheduleService.updateSlot(scheduleData.schedule.id, slot.id, { status: newStatus })
			loadSchedule()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка обновления статуса')
		}
	}

	const findAllConflictPairs = () => {
		const slots = scheduleData?.slots?.filter(s => s.status !== 'cancelled') || []
		const pairs = []
		for (let i = 0; i < slots.length; i++) {
			for (let j = i + 1; j < slots.length; j++) {
				const a = slots[i]
				const b = slots[j]
				if (a.weekday !== b.weekday) continue
				const aStart = timeToMinutes(a.start_time)
				const aEnd = timeToMinutes(a.end_time)
				const bStart = timeToMinutes(b.start_time)
				const bEnd = timeToMinutes(b.end_time)
				if (!(aStart < bEnd + 5 && aEnd > bStart - 5)) continue
				const sameTeacher = a.teacher_id === b.teacher_id
				const sameRoom = a.room_id && b.room_id && a.room_id === b.room_id
				const studentA = getSlotStudentIds(a)
				const studentB = getSlotStudentIds(b)
				const sameStudent = studentA.some(id => studentB.includes(id))
				if (sameTeacher || sameRoom || sameStudent) {
					pairs.push({ a, b })
				}
			}
		}
		return pairs
	}

	const approve = async () => {
		const pairs = findAllConflictPairs()
		if (pairs.length > 0) {
			setApproveConflictDialog({ open: true, pairs })
			return
		}
		try {
			await scheduleService.approveSchedule(scheduleData.schedule.id)
			toast.success('Расписание утверждено')
			loadSchedule()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка')
		}
	}

	const unapprove = async () => {
		try {
			await scheduleService.unapproveSchedule(scheduleData.schedule.id)
			toast.success('Утверждение снято')
			loadSchedule()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка')
		}
	}

	const doResetAuto = async () => {
		setGenerating(true)
		setGenerationProgress({ percent: 0, message: 'Запуск пересчёта...' })
		try {
			const job = await scheduleService.startResetAutoSchedule(scheduleData.schedule.id)
			setGenerationProgress(job)
			await pollGenerationJob(job.id, 'Авто-слоты сброшены и пересчитаны')
		} catch (e) {
			toast.error(e.response?.data?.error || e.message || 'Ошибка')
		} finally {
			setGenerating(false)
			setGenerationProgress(null)
		}
	}

	const resetAuto = () => {
		const doIt = () => doResetAuto()
		if (isPastWeek) {
			openPastWeekConfirm('Удалить авто-слоты прошедшей недели и перегенерировать? Ручные слоты сохранятся.', doIt)
		} else {
			doIt()
		}
	}

	const doClearAuto = async () => {
		try {
			const data = await scheduleService.clearAutoSchedule(scheduleData.schedule.id)
			setScheduleData(data)
			toast.success('Авто-слоты очищены')
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка очистки')
		}
	}

	const clearAuto = () => {
		const doIt = () => doClearAuto()
		if (isPastWeek) {
			openPastWeekConfirm('Удалить все авто-слоты прошедшей недели? Ручные слоты сохранятся. Перегенерации не будет.', doIt)
		} else {
			doIt()
		}
	}

	const copyManualFromPrevWeek = async () => {
		if (!scheduleData?.schedule?.id) return
		try {
			const data = await scheduleService.copyManualSlotsFromPrevWeek(scheduleData.schedule.id)
			setScheduleData(data)
			toast.success('Ручные слоты из прошлой недели скопированы')
		} catch (e) {
			toast.error(e.response?.data?.error || 'Нет ручных слотов в прошлой неделе или ошибка')
		}
	}

	const openDeleteManualDialog = () => {
		setDeleteManualDialog({ open: true, countdown: 5 })
		let count = 5
		deleteManualTimerRef.current = setInterval(() => {
			count -= 1
			setDeleteManualDialog(prev => ({ ...prev, countdown: count }))
			if (count <= 0) {
				clearInterval(deleteManualTimerRef.current)
				deleteManualTimerRef.current = null
			}
		}, 1000)
	}

	const closeDeleteManualDialog = () => {
		if (deleteManualTimerRef.current) {
			clearInterval(deleteManualTimerRef.current)
			deleteManualTimerRef.current = null
		}
		setDeleteManualDialog({ open: false, countdown: 5 })
	}

	const doDeleteManualSlots = async () => {
		closeDeleteManualDialog()
		try {
			const data = await scheduleService.clearManualSlots(scheduleData.schedule.id)
			setScheduleData(data)
			toast.success('Ручные слоты удалены')
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка удаления ручных слотов')
		}
	}

	const exportTeachersToExcel = async () => {
		if (!scheduleData?.slots?.length) {
			toast.error('Нет слотов для экспорта')
			return
		}
		const slotsByTeacher = {}
		for (const slot of scheduleData.slots) {
			if (slot.status === 'cancelled') continue
			const name = slot.teacher?.full_name || `ID ${slot.teacher_id}`
			if (!slotsByTeacher[name]) slotsByTeacher[name] = []
			slotsByTeacher[name].push(slot)
		}
		if (!Object.keys(slotsByTeacher).length) {
			toast.error('Нет слотов для экспорта')
			return
		}

		const workbook = new ExcelJS.Workbook()
		workbook.creator = 'Rassvet'
		const weekLabel = formatWeekLabel(weekStart)

		const C = {
			headerBg:  'FF283593',
			titleBg:   'FF1A237E',
			dayBg:     'FFE8EAF6',
			paid:      'FFFDE8E8',
			budget:    'FFE8F0FE',
			group:     'FFE8F5E9',
			white:     'FFFFFFFF',
		}

		for (const [teacherName, slots] of Object.entries(slotsByTeacher)) {
			const sheetName = teacherName.slice(0, 31)
			const ws = workbook.addWorksheet(sheetName)
			ws.columns = [
				{ width: 15 }, { width: 13 }, { width: 11 },
				{ width: 28 }, { width: 18 }, { width: 14 }, { width: 13 },
			]

			// Title
			const r1 = ws.addRow([teacherName, '', '', '', '', '', ''])
			ws.mergeCells(`A${r1.number}:G${r1.number}`)
			r1.height = 24
			r1.getCell(1).font = { bold: true, size: 14, color: { argb: C.white } }
			r1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.titleBg } }
			r1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

			// Week subtitle
			const r2 = ws.addRow([`Неделя: ${weekLabel}`, '', '', '', '', '', ''])
			ws.mergeCells(`A${r2.number}:G${r2.number}`)
			r2.getCell(1).font = { italic: true, size: 10 }
			r2.getCell(1).alignment = { horizontal: 'center' }

			// Column headers
			const hRow = ws.addRow(['День', 'Время', 'Тип', 'Ученик / Группа', 'Предмет', 'Кабинет', 'Финансирование'])
			hRow.height = 18
			hRow.eachCell(cell => {
				cell.font = { bold: true, color: { argb: C.white }, size: 10 }
				cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.headerBg } }
				cell.alignment = { horizontal: 'center', vertical: 'middle' }
				cell.border = { bottom: { style: 'thin', color: { argb: 'FFAAAAAA' } } }
			})

			const sorted = [...slots].sort((a, b) =>
				a.weekday !== b.weekday ? a.weekday - b.weekday : a.start_time.localeCompare(b.start_time)
			)

			let lastDay = null
			for (const slot of sorted) {
				if (slot.weekday !== lastDay) {
					const dr = ws.addRow([WEEKDAY_NAMES[slot.weekday] || slot.weekday, '', '', '', '', '', ''])
					ws.mergeCells(`A${dr.number}:G${dr.number}`)
					dr.getCell(1).font = { bold: true, size: 10 }
					dr.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.dayBg } }
					dr.getCell(1).alignment = { horizontal: 'left', indent: 1, vertical: 'middle' }
					dr.height = 16
					lastDay = slot.weekday
				}

				const isGroup = slot.slot_type === 'group'
				const isPaid = !isGroup && slot.assignment?.funding_type === 'paid'
				const bg = isGroup ? C.group : isPaid ? C.paid : C.budget
				const studentLabel = isGroup ? (slot.group_lesson?.name || 'Группа') : (slot.student?.full_name || '—')
				const fundingLabel = isGroup ? 'Группа' : isPaid ? 'Платник' : 'Бюджет'

				const row = ws.addRow([
					'',
					`${slot.start_time}–${slot.end_time}`,
					isGroup ? 'Групповое' : 'Индив.',
					studentLabel,
					slot.subject?.name || '—',
					slot.room_name || slot.room?.name || '—',
					fundingLabel,
				])
				row.height = 15
				row.eachCell(cell => {
					cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
					cell.alignment = { vertical: 'middle' }
					cell.border = { bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } } }
				})
			}
		}

		const buffer = await workbook.xlsx.writeBuffer()
		const blob = new Blob([buffer], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		})
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `Расписание_${formatDateISO(weekStart)}.xlsx`
		a.click()
		URL.revokeObjectURL(url)
	}

	const getActiveGroupEnrollments = slot => {
		const excluded = new Set((slot.exclusions || []).map(ex => ex.student_id))
		return (slot.group_lesson?.enrollments || []).filter(enr => !excluded.has(enr.student_id))
	}

	const exportStudentsToExcel = async () => {
		if (!scheduleData?.slots?.length) {
			toast.error('Нет слотов для экспорта')
			return
		}

		const slotsByStudent = {}
		for (const slot of scheduleData.slots) {
			if (slot.status === 'cancelled') continue
			if (slot.slot_type === 'group') {
				for (const enr of getActiveGroupEnrollments(slot)) {
					const name = enr.student?.full_name || `ID ${enr.student_id}`
					if (!slotsByStudent[name]) slotsByStudent[name] = []
					slotsByStudent[name].push(slot)
				}
				continue
			}
			const name = slot.student?.full_name || `ID ${slot.student_id}`
			if (!slotsByStudent[name]) slotsByStudent[name] = []
			slotsByStudent[name].push(slot)
		}

		if (!Object.keys(slotsByStudent).length) {
			toast.error('Нет слотов для экспорта')
			return
		}

		const workbook = new ExcelJS.Workbook()
		workbook.creator = 'Rassvet'
		const weekLabel = formatWeekLabel(weekStart)
		const C = {
			headerBg: 'FF2E7D32',
			titleBg: 'FF1B5E20',
			dayBg: 'FFE8F5E9',
			lesson: 'FFF1F8E9',
			white: 'FFFFFFFF',
		}

		for (const [studentName, slots] of Object.entries(slotsByStudent)) {
			const ws = workbook.addWorksheet(studentName.slice(0, 31))
			ws.columns = [{ width: 15 }, { width: 13 }, { width: 14 }, { width: 24 }, { width: 24 }, { width: 16 }]

			const r1 = ws.addRow([studentName, '', '', '', '', ''])
			ws.mergeCells(`A${r1.number}:F${r1.number}`)
			r1.height = 24
			r1.getCell(1).font = { bold: true, size: 14, color: { argb: C.white } }
			r1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.titleBg } }
			r1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

			const r2 = ws.addRow([`Неделя: ${weekLabel}`, '', '', '', '', ''])
			ws.mergeCells(`A${r2.number}:F${r2.number}`)
			r2.getCell(1).font = { italic: true, size: 10 }
			r2.getCell(1).alignment = { horizontal: 'center' }

			const hRow = ws.addRow(['День', 'Время', 'Тип', 'Предмет', 'Преподаватель', 'Кабинет'])
			hRow.eachCell(cell => {
				cell.font = { bold: true, color: { argb: C.white }, size: 10 }
				cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.headerBg } }
				cell.alignment = { horizontal: 'center', vertical: 'middle' }
			})

			const sorted = [...slots].sort((a, b) =>
				a.weekday !== b.weekday ? a.weekday - b.weekday : a.start_time.localeCompare(b.start_time)
			)
			let lastDay = null
			for (const slot of sorted) {
				if (slot.weekday !== lastDay) {
					const dr = ws.addRow([WEEKDAY_NAMES[slot.weekday] || slot.weekday, '', '', '', '', ''])
					ws.mergeCells(`A${dr.number}:F${dr.number}`)
					dr.getCell(1).font = { bold: true, size: 10 }
					dr.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.dayBg } }
					lastDay = slot.weekday
				}

				const row = ws.addRow([
					'',
					`${slot.start_time}-${slot.end_time}`,
					slot.slot_type === 'group' ? 'Групповое' : 'Индив.',
					slot.subject?.name || '-',
					slot.teacher?.full_name || '-',
					slot.room_name || slot.room?.name || '-',
				])
				row.eachCell(cell => {
					cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.lesson } }
					cell.border = { bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } } }
				})
			}
		}

		const buffer = await workbook.xlsx.writeBuffer()
		const blob = new Blob([buffer], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		})
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `Расписание_дети_${formatDateISO(weekStart)}.xlsx`
		a.click()
		URL.revokeObjectURL(url)
	}

	const openCreateSlot = () => {
		setSlotForm(EMPTY_SLOT_FORM)
		setCreateDialog(true)
	}

	const doCreateSlot = async (force = false) => {
		let assignment = assignments.find(a => a.id === Number(slotForm.assignment_id))
		const groupLesson = groupLessons.find(g => g.id === Number(slotForm.group_lesson_id))
		try {
			// Create empty schedule for the week if none exists yet
			let scheduleId = scheduleData?.schedule?.id
			if (!scheduleId) {
				const newSchedule = await scheduleService.createEmptySchedule(weekStartISO)
				setScheduleData(newSchedule)
				scheduleId = newSchedule.schedule.id
			}

			if (slotForm.slot_type === 'individual' && !assignment) {
				assignment = assignments.find(a =>
					a.student_id === Number(slotForm.student_id) &&
					a.teacher_id === Number(slotForm.teacher_id) &&
					a.subject_id === Number(slotForm.subject_id),
				)
			}
			if (slotForm.slot_type === 'individual' && !assignment) {
				const duration = timeToMinutes(slotForm.end_time) - timeToMinutes(slotForm.start_time)
				assignment = await scheduleService.createAssignment({
					student_id: Number(slotForm.student_id),
					teacher_id: Number(slotForm.teacher_id),
					subject_id: Number(slotForm.subject_id),
					funding_type: 'budget',
					visits_per_week: 1,
					duration_min: duration,
					status: 'active',
				})
				setAssignments(prev => [...prev, assignment])
				setSlotForm(prev => ({ ...prev, assignment_id: assignment.id }))
			}

			const payload = slotForm.slot_type === 'group'
				? {
					slot_type: 'group',
					group_lesson_id: Number(slotForm.group_lesson_id),
					teacher_id: Number(slotForm.teacher_id || groupLesson.default_teacher_id),
					room_name: slotForm.room_name || groupLesson.room_name,
					weekday: Number(slotForm.weekday),
					start_time: slotForm.start_time,
					end_time: slotForm.end_time,
				}
				: {
					slot_type: 'individual',
					assignment_id: assignment.id,
					student_id: assignment.student_id,
					teacher_id: assignment.teacher_id,
					subject_id: assignment.subject_id,
					room_id: Number(slotForm.room_id),
					weekday: Number(slotForm.weekday),
					start_time: slotForm.start_time,
					end_time: slotForm.end_time,
				}
			await scheduleService.createSlot(scheduleId, payload, force)
			toast.success('Слот добавлен')
			setCreateDialog(false)
			loadSchedule()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка создания слота')
		}
	}

	const createSlot = async () => {
		if (slotForm.slot_type === 'group') {
			const groupLesson = groupLessons.find(g => g.id === Number(slotForm.group_lesson_id))
			if (!groupLesson) {
				toast.error('?????? ?? ???????')
				return
			}
			const teacherId = Number(slotForm.teacher_id || groupLesson.default_teacher_id)
			if (!teacherId) {
				toast.error('???????? ?????????????')
				return
			}
			if (!String(slotForm.room_name || groupLesson.room_name || '').trim()) {
				toast.error('??????? ??????? ??? ????? ??????????')
				return
			}
			const conflicts = findConflictingSlots(
				Number(slotForm.weekday), slotForm.start_time, slotForm.end_time,
				null, teacherId,
				(groupLesson.enrollments || []).map(enr => enr.student_id),
			)
			if (conflicts.length > 0) {
				pendingSlotAction.current = doCreateSlot
				setConflictDialog({ open: true, conflicts, deleteConflicts: true })
				return
			}
			await doCreateSlot()
			return
		}

		if (!slotForm.room_id) {
			toast.error('???????? ?????????? ? ???????')
			return
		}
		let assignment = assignments.find(a => a.id === Number(slotForm.assignment_id))
		if (!assignment) {
			if (!slotForm.student_id || !slotForm.teacher_id || !slotForm.subject_id) {
				toast.error('Выберите ребёнка, преподавателя и предмет')
				return
			}
			assignment = assignments.find(a =>
				a.student_id === Number(slotForm.student_id) &&
				a.teacher_id === Number(slotForm.teacher_id) &&
				a.subject_id === Number(slotForm.subject_id),
			)
			if (!assignment) {
				if (!window.confirm('Такого назначения не существует. Создать его и добавить ручное занятие?')) {
					return
				}
				const duration = timeToMinutes(slotForm.end_time) - timeToMinutes(slotForm.start_time)
				if (duration !== 30 && duration !== 50) {
					toast.error('Для нового назначения длительность должна быть 30 или 50 минут')
					return
				}
			} else {
				setSlotForm(prev => ({ ...prev, assignment_id: assignment.id }))
			}
		}
		const studentId = assignment ? assignment.student_id : Number(slotForm.student_id)
		const teacherId = assignment ? assignment.teacher_id : Number(slotForm.teacher_id)
		const conflicts = findConflictingSlots(
			Number(slotForm.weekday), slotForm.start_time, slotForm.end_time,
			Number(slotForm.room_id), teacherId, [studentId],
		)
		if (conflicts.length > 0) {
			pendingSlotAction.current = doCreateSlot
			setConflictDialog({ open: true, conflicts, deleteConflicts: true })
			return
		}
		await doCreateSlot()
	}
	const openEditSlot = slot => {
		setEditForm({
			weekday: slot.weekday,
			start_time: slot.start_time,
			end_time: slot.end_time,
			room_id: slot.room_id,
			status: slot.status,
		})
		setAddGroupStudentId('')
		setEditDialog({ open: true, slot })
	}

	const doSaveEditSlot = async () => {
		try {
			await scheduleService.updateSlot(
				scheduleData.schedule.id,
				editDialog.slot.id,
				editForm,
			)
			toast.success('Слот обновлён')
			setEditDialog({ open: false, slot: null })
			loadSchedule()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка обновления')
		}
	}

	const saveEditSlot = async () => {
		const slot = editDialog.slot
		const conflicts = findConflictingSlots(
			editForm.weekday,
			editForm.start_time,
			editForm.end_time,
			editForm.room_id,
			slot?.teacher_id,
			getSlotStudentIds(slot),
			slot?.id,
		)
		if (conflicts.length > 0) {
			pendingSlotAction.current = doSaveEditSlot
			setConflictDialog({ open: true, conflicts, deleteConflicts: true })
			return
		}
		await doSaveEditSlot()
	}

	const pinSlotAsManual = async slot => {
		if (slot.origin !== 'auto') return
		try {
			await scheduleService.pinSlot(scheduleData.schedule.id, slot.id)
			toast.success('Занятие закреплено')
			loadSchedule()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Не удалось закрепить занятие')
		}
	}

	const unpinSlotAsAuto = async slot => {
		if (slot.origin !== 'manual') return
		try {
			await scheduleService.unpinSlot(scheduleData.schedule.id, slot.id)
			toast.success('\u0417\u0430\u043d\u044f\u0442\u0438\u0435 \u0441\u043d\u043e\u0432\u0430 \u0430\u0432\u0442\u043e')
			loadSchedule()
		} catch (e) {
			toast.error(e.response?.data?.error || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u0435\u0440\u0435\u0432\u0435\u0441\u0442\u0438 \u0437\u0430\u043d\u044f\u0442\u0438\u0435 \u0432 \u0430\u0432\u0442\u043e')
		}
	}
	const deleteSlot = async slotId => {
		if (!window.confirm('Удалить слот?')) return
		try {
			await scheduleService.deleteSlot(scheduleData.schedule.id, slotId)
			toast.success('Слот удалён')
			loadSchedule()
		} catch {
			toast.error('Ошибка удаления')
		}
	}

	const handleExcludeStudent = async (slot, studentId) => {
		try {
			await scheduleService.addSlotExclusion(scheduleData.schedule.id, slot.id, studentId)
			toast.success('Ученик исключён из занятия')
			// Reload and update editDialog slot
			const data = await scheduleService.getScheduleByWeek(weekStartISO)
			setScheduleData(data)
			const updatedSlot = data.slots?.find(s => s.id === slot.id)
			if (updatedSlot) setEditDialog(prev => ({ ...prev, slot: updatedSlot }))
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка')
		}
	}

	const handleIncludeStudent = async (slot, studentId) => {
		try {
			await scheduleService.removeSlotExclusion(scheduleData.schedule.id, slot.id, studentId)
			toast.success('Ученик возвращён в занятие')
			const data = await scheduleService.getScheduleByWeek(weekStartISO)
			setScheduleData(data)
			const updatedSlot = data.slots?.find(s => s.id === slot.id)
			if (updatedSlot) setEditDialog(prev => ({ ...prev, slot: updatedSlot }))
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка')
		}
	}

	const handleToggleAttendance = async (studentId, isCurrentlyExcluded) => {
		const slot = attendanceDialog.slot
		try {
			if (isCurrentlyExcluded) {
				await scheduleService.removeSlotExclusion(scheduleData.schedule.id, slot.id, studentId)
			} else {
				await scheduleService.addSlotExclusion(scheduleData.schedule.id, slot.id, studentId)
			}
			const data = await scheduleService.getScheduleByWeek(weekStartISO)
			setScheduleData(data)
			const updatedSlot = data.slots?.find(s => s.id === slot.id)
			if (updatedSlot) setAttendanceDialog(prev => ({ ...prev, slot: updatedSlot }))
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка')
		}
	}

	const handleAddStudentToGroupSlot = async () => {
		const slot = editDialog.slot
		if (!slot?.group_lesson_id || !addGroupStudentId) return
		try {
			await scheduleService.addGroupEnrollment(slot.group_lesson_id, Number(addGroupStudentId))
			toast.success('Ученик добавлен в группу')
			setAddGroupStudentId('')
			const data = await scheduleService.getScheduleByWeek(weekStartISO)
			setScheduleData(data)
			const updatedSlot = data.slots?.find(s => s.id === slot.id)
			if (updatedSlot) setEditDialog(prev => ({ ...prev, slot: updatedSlot }))
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка добавления ученика')
		}
	}

	const timeToMinutes = t => {
		const [h, m] = t.split(':').map(Number)
		return h * 60 + m
	}

	const getSlotStudentIds = slot => {
		if (slot.slot_type === 'group') {
			return getActiveGroupEnrollments(slot).map(enr => enr.student_id)
		}
		return slot.student_id ? [slot.student_id] : []
	}

	const findConflictingSlots = (weekday, startTime, endTime, roomId, teacherId, studentIds = [], excludeSlotId = null) => {
		if (!scheduleData?.slots) return []
		const checkedStudentIds = new Set(Array.isArray(studentIds) ? studentIds : [studentIds].filter(Boolean))
		const start = timeToMinutes(startTime)
		const end = timeToMinutes(endTime)
		return scheduleData.slots.filter(s => {
			if (excludeSlotId && s.id === excludeSlotId) return false
			if (s.weekday !== weekday) return false
			const sStart = timeToMinutes(s.start_time)
			const sEnd = timeToMinutes(s.end_time)
			if (!(start < sEnd + 5 && end > sStart - 5)) return false
			// Only flag conflicts for matching room, teacher, or student
			const hasStudentConflict = getSlotStudentIds(s).some(id => checkedStudentIds.has(id))
			const hasRoomConflict = roomId && s.room_id === roomId
			return hasRoomConflict || s.teacher_id === teacherId || hasStudentConflict
		})
	}

	const describeConflictingSlot = s => {
		const time = `${s.start_time}–${s.end_time}`
		const day = WEEKDAY_NAMES[s.weekday] || s.weekday
		if (s.slot_type === 'group') {
			return `${day} ${time}: ${s.group_lesson?.name || 'Группа'} (${s.teacher?.full_name || '—'}, ${s.room?.name || '—'})`
		}
		return `${day} ${time}: ${s.student?.full_name || '—'} → ${s.teacher?.full_name || '—'} (${s.subject?.name || '—'}, ${s.room?.name || '—'})`
	}

	const handleConflictConfirm = async () => {
		const force = !conflictDialog.deleteConflicts
		try {
			if (conflictDialog.deleteConflicts) {
				for (const s of conflictDialog.conflicts) {
					await scheduleService.deleteSlot(scheduleData.schedule.id, s.id)
				}
			}
			setConflictDialog({ open: false, conflicts: [], deleteConflicts: true })
			if (pendingSlotAction.current) {
				await pendingSlotAction.current(force)
				pendingSlotAction.current = null
			}
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка')
		}
	}

	// Group slots by weekday with filters
	const slotsByDay = {}
	if (scheduleData?.slots) {
		for (const slot of scheduleData.slots) {
			if (filterStudentId) {
				if (slot.slot_type === 'group') {
					const enrolled = slot.group_lesson?.enrollments?.some(
						e => e.student_id === Number(filterStudentId),
					)
					if (!enrolled) continue
				} else {
					if (slot.student_id !== Number(filterStudentId)) continue
				}
			}
			if (filterTeacherId && slot.teacher_id !== Number(filterTeacherId)) continue
			if (filterRoomId && slot.room_id !== Number(filterRoomId)) continue
			if (filterFundingType) {
				if (slot.slot_type === 'group') {
					// group slots are not filtered by funding type
				} else {
					if (slot.assignment?.funding_type !== filterFundingType) continue
				}
			}
			if (!slotsByDay[slot.weekday]) slotsByDay[slot.weekday] = []
			slotsByDay[slot.weekday].push(slot)
		}
		// Sort each day by start_time
		for (const day of Object.keys(slotsByDay)) {
			slotsByDay[day].sort((a, b) => a.start_time.localeCompare(b.start_time))
		}
	}

	const schedule = scheduleData?.schedule
	const stats = scheduleData?.stats
	const issues = scheduleData?.issues || []
	const isDraft = schedule?.status === 'draft'
	const isApproved = schedule?.status === 'approved'
	const canAddSlot = isDraft || isApproved

	return (
		<Container maxWidth='xl' sx={{ mt: 4 }}>
			<Paper elevation={3} sx={{ p: 4 }}>
				{/* Header */}
				<Box
					display='flex'
					justifyContent='space-between'
					alignItems='center'
					mb={3}
				>
					<Typography variant='h4'>Расписание</Typography>
					<Button
						startIcon={<BackIcon />}
						onClick={() => navigate('/admin/schedule')}
					>
						Назад
					</Button>
				</Box>

				{/* Week navigation */}
				<Box
					display='flex'
					alignItems='center'
					justifyContent='center'
					gap={2}
					mb={3}
				>
					<IconButton onClick={prevWeek} size='large'>
						<ChevronLeft />
					</IconButton>
					<Typography
						variant='h6'
						sx={{
							minWidth: 320, textAlign: 'center', fontWeight: 500,
							...(isCurrentWeek && {
								color: 'primary.main',
								fontWeight: 700,
							}),
						}}
					>
						{formatWeekLabel(weekStart)}
						{isCurrentWeek && (
							<Typography component='span' variant='caption' sx={{ ml: 1, color: 'primary.main', fontWeight: 400 }}>
								(текущая неделя)
							</Typography>
						)}
					</Typography>
					<IconButton onClick={nextWeek} size='large'>
						<ChevronRight />
					</IconButton>
				</Box>

				{/* Action bar */}
				<Box display='flex' alignItems='center' gap={2} mb={3} flexWrap='wrap'>
					{schedule && (
						<Chip
							label={STATUS_LABELS[schedule.status] || schedule.status}
							color={STATUS_COLORS[schedule.status] || 'default'}
							size='medium'
						/>
					)}

					{/* Generate — visible when no schedule or draft */}
					{(isDraft || (!schedule && !loading)) && (
						<Button
							variant={!schedule ? 'contained' : 'outlined'}
							startIcon={<GenerateIcon />}
							onClick={generate}
							disabled={generating}
							color={isPastWeek ? 'warning' : 'primary'}
						>
							{generating ? 'Генерация...' : isPastWeek ? '⚠ Сгенерировать расписание' : 'Сгенерировать расписание'}
						</Button>
					)}

					{/* Draft-mode buttons — visible in draft OR when no schedule (disabled when no schedule) */}
					{(isDraft || (!schedule && !loading)) && (
						<>
							<Button
								variant='contained'
								color='success'
								startIcon={<ApproveIcon />}
								onClick={approve}
								disabled={!schedule}
							>
								Утвердить
							</Button>
							<Button
								variant='outlined'
								startIcon={<ClearIcon />}
								onClick={clearAuto}
								disabled={!schedule || generating}
								color={isPastWeek ? 'warning' : 'error'}
							>
								{isPastWeek ? '⚠ Очистить авто' : 'Очистить авто'}
							</Button>
							<Button
								variant='outlined'
								color='inherit'
								onClick={copyManualFromPrevWeek}
								disabled={!schedule || generating}
							>
								Скопировать ручные слоты
							</Button>
							<Button
								variant='outlined'
								color='error'
								onClick={openDeleteManualDialog}
								disabled={!schedule}
							>
								Удалить ручные слоты
							</Button>
						</>
					)}

					{isApproved && (
						<Button
							variant='outlined'
							color='warning'
							startIcon={<UnapproveIcon />}
							onClick={unapprove}
						>
							Снять утверждение
						</Button>
					)}

					{/* Add Slot — always visible, creates schedule if needed */}
					{(canAddSlot || (!schedule && !loading)) && (
						<Button
							variant='outlined'
							startIcon={<AddIcon />}
							onClick={openCreateSlot}
						>
							Добавить слот
						</Button>
					)}

					{/* Export — visible in draft or no-schedule states, disabled when no schedule */}
					{(isDraft || (!schedule && !loading)) && (
						<>
							<Button
								variant='outlined'
								color='success'
								startIcon={<ExcelIcon />}
								onClick={exportTeachersToExcel}
								disabled={!schedule}
							>
								Экспорт преподавателей
							</Button>
							<Button
								variant='outlined'
								color='success'
								startIcon={<ExcelIcon />}
								onClick={exportStudentsToExcel}
								disabled={!schedule}
							>
								Экспорт детей
							</Button>
						</>
					)}
					{isApproved && (
						<>
							<Button
								variant='outlined'
								color='success'
								startIcon={<ExcelIcon />}
								onClick={exportTeachersToExcel}
							>
								Экспорт преподавателей
							</Button>
							<Button
								variant='outlined'
								color='success'
								startIcon={<ExcelIcon />}
								onClick={exportStudentsToExcel}
							>
								Экспорт детей
							</Button>
						</>
					)}
				</Box>

				{generationProgress && (
					<Paper variant='outlined' sx={{ p: 2, mb: 3 }}>
						<Box display='flex' justifyContent='space-between' alignItems='center' mb={1}>
							<Box>
								<Typography variant='subtitle1' fontWeight={600}>
									Идёт генерация...
								</Typography>
								<Typography variant='body2' color='text.secondary'>
									{generationProgress.message || 'Расписание рассчитывается'}
									{generationProgress.strategy ? ` · ${generationProgress.strategy}` : ''}
								</Typography>
							</Box>
							<Typography variant='h6' sx={{ minWidth: 64, textAlign: 'right' }}>
								{Math.round(generationProgress.percent || 0)}%
							</Typography>
						</Box>
						<LinearProgress
							variant='determinate'
							value={Math.max(0, Math.min(100, generationProgress.percent || 0))}
							sx={{ height: 10, borderRadius: 1 }}
						/>
					</Paper>
				)}

				{/* Slot filters */}
				{schedule && (
					<Paper variant='outlined' sx={{ p: 2, mb: 2 }}>
						<Grid container spacing={2} alignItems='center'>
							<Grid item xs={12} sm={3}>
								<FormControl fullWidth size='small'>
									<InputLabel>Ученик</InputLabel>
									<Select
										value={filterStudentId}
										label='Ученик'
										onChange={e => setFilterStudentId(e.target.value)}
									>
										<MenuItem value=''>Все ученики</MenuItem>
										{students.map(s => (
											<MenuItem key={s.id} value={s.id}>
												{s.full_name}
											</MenuItem>
										))}
									</Select>
								</FormControl>
							</Grid>
							<Grid item xs={12} sm={3}>
								<FormControl fullWidth size='small'>
									<InputLabel>Преподаватель</InputLabel>
									<Select
										value={filterTeacherId}
										label='Преподаватель'
										onChange={e => setFilterTeacherId(e.target.value)}
									>
										<MenuItem value=''>Все преподаватели</MenuItem>
										{teachers.map(t => (
											<MenuItem key={t.id} value={t.id}>
												{t.full_name}
											</MenuItem>
										))}
									</Select>
								</FormControl>
							</Grid>
							<Grid item xs={12} sm={3}>
								<FormControl fullWidth size='small'>
									<InputLabel>Кабинет</InputLabel>
									<Select
										value={filterRoomId}
										label='Кабинет'
										onChange={e => setFilterRoomId(e.target.value)}
									>
										<MenuItem value=''>Все кабинеты</MenuItem>
										{rooms.map(r => (
											<MenuItem key={r.id} value={r.id}>
												{r.name}
											</MenuItem>
										))}
									</Select>
								</FormControl>
							</Grid>
							<Grid item xs={12} sm={3}>
								<FormControl fullWidth size='small'>
									<InputLabel>Финансирование</InputLabel>
									<Select
										value={filterFundingType}
										label='Финансирование'
										onChange={e => setFilterFundingType(e.target.value)}
									>
										<MenuItem value=''>Все</MenuItem>
										<MenuItem value='paid'>Платники</MenuItem>
										<MenuItem value='budget'>Бюджетники</MenuItem>
									</Select>
								</FormControl>
							</Grid>
							<Grid item xs={12} sm={3}>
								<Button
									size='small'
									onClick={() => {
										setFilterStudentId('')
										setFilterTeacherId('')
										setFilterRoomId('')
										setFilterFundingType('')
									}}
									disabled={!filterStudentId && !filterTeacherId && !filterRoomId && !filterFundingType}
								>
									Сбросить фильтры
								</Button>
							</Grid>
						</Grid>

						{/* Color legend */}
						<Box display='flex' gap={2} mt={1.5} flexWrap='wrap'>
							<Box display='flex' alignItems='center' gap={0.5}>
								<Box sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: 'rgba(244,67,54,0.25)' }} />
								<Typography variant='caption'>Платник (индив.)</Typography>
							</Box>
							<Box display='flex' alignItems='center' gap={0.5}>
								<Box sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: 'rgba(33,150,243,0.25)' }} />
								<Typography variant='caption'>Бюджетник (индив.)</Typography>
							</Box>
							<Box display='flex' alignItems='center' gap={0.5}>
								<Box sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: 'rgba(76,175,80,0.25)' }} />
								<Typography variant='caption'>Групповое занятие</Typography>
							</Box>
						</Box>
					</Paper>
				)}

				{/* Stats */}
				{stats && (
					<Paper variant='outlined' sx={{ p: 2, mb: 3 }}>
						<Grid container spacing={2} textAlign='center'>
							<Grid item xs={4}>
								<Typography variant='h4' color='primary.main'>
									{stats.total_requested}
								</Typography>
								<Typography variant='body2' color='text.secondary'>
									Запрошено занятий
								</Typography>
								<Typography variant='caption' color='text.disabled'>
									{stats.ind_requested} инд. + {stats.grp_requested} групп.
								</Typography>
							</Grid>
							<Grid item xs={4}>
								<Typography variant='h4' color='success.main'>
									{stats.scheduled}
								</Typography>
								<Typography variant='body2' color='text.secondary'>
									Поставлено
								</Typography>
								<Typography variant='caption' color='text.disabled'>
									{stats.ind_scheduled} инд. + {stats.grp_scheduled} групп.
								</Typography>
							</Grid>
							<Grid item xs={4}>
								<Typography
									variant='h4'
									color={stats.unplaced > 0 ? 'error.main' : 'text.secondary'}
								>
									{stats.unplaced}
								</Typography>
								<Typography variant='body2' color='text.secondary'>
									Не поставлено
								</Typography>
							</Grid>
						</Grid>
					</Paper>
				)}

				{/* Loading */}
				{loading && (
					<Box display='flex' justifyContent='center' p={4}>
						<CircularProgress />
					</Box>
				)}

				{/* No schedule */}
				{!loading && !schedule && (
					<Alert severity='info'>
						Расписание на эту неделю ещё не создано. Нажмите «Сгенерировать
						расписание», чтобы создать черновик.
					</Alert>
				)}

				{/* Slots grouped by weekday */}
				{!loading &&
					schedule &&
					Object.keys(WEEKDAY_NAMES).map(dayStr => {
						const day = Number(dayStr)
						const daySlots = slotsByDay[day] || []
						if (!daySlots.length) return null
						return (
							<Box key={day} mb={3}>
								<Typography
									variant='h6'
									sx={{ mb: 1, color: 'primary.main', fontWeight: 600 }}
								>
									{WEEKDAY_NAMES[day]}{' '}
									<Typography component='span' variant='body1' color='text.secondary' fontWeight={400}>
										{getWeekdayDate(weekStart, day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
									</Typography>
								</Typography>
								<TableContainer>
									<Table size='small'>
										<TableHead>
											<TableRow>
												<TableCell>Время</TableCell>
												<TableCell>{'\u0414\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c'}</TableCell>
												<TableCell>Ученик / Группа</TableCell>
												<TableCell>Преподаватель</TableCell>
												<TableCell>Предмет</TableCell>
												<TableCell>Кабинет</TableCell>
												<TableCell>Происхождение</TableCell>
												<TableCell>Статус</TableCell>
												<TableCell align='center'>Действия</TableCell>
											</TableRow>
										</TableHead>
										<TableBody>
											{daySlots.map(slot => (
												<TableRow
													key={slot.id}
													sx={{ bgcolor: getSlotBgColor(slot) }}
												>
													<TableCell>
														{slot.start_time}–{slot.end_time}
													</TableCell>
													<TableCell>{getSlotDuration(slot)} {'\u043c\u0438\u043d'}</TableCell>
													<TableCell>
														{slot.slot_type === 'group'
															? <><strong>{slot.group_lesson?.name || '—'}</strong>
																{' '}
																<Typography component='span' variant='caption' color='text.secondary'>
																	({slot.group_lesson?.enrollments?.length || 0} уч.)
																</Typography>
															</>
															: (slot.student?.full_name || slot.student_id)
														}
													</TableCell>
													<TableCell>
														{slot.teacher?.full_name || slot.teacher_id}
													</TableCell>
													<TableCell>
														{slot.subject?.name || slot.subject_id}
													</TableCell>
													<TableCell>
														{slot.room_name || slot.room?.name || slot.room_id || '—'}
													</TableCell>
													<TableCell>
														<Chip
															label={slot.origin === 'auto' ? 'Авто' : 'Ручной'}
															color={slot.origin === 'auto' ? 'secondary' : 'primary'}
															size='small'
															variant='outlined'
														/>
													</TableCell>
													<TableCell>
														<Chip
															label={SLOT_STATUS_LABELS[slot.status] || slot.status}
															color={SLOT_STATUS_COLORS[slot.status] || 'default'}
															size='small'
														/>
													</TableCell>
													<TableCell align='center'>
														{slot.origin === 'auto' && (
															<IconButton
																size='small'
																color='primary'
																onClick={() => pinSlotAsManual(slot)}
																title='Закрепить как ручное'
															>
																<LockIcon fontSize='small' />
															</IconButton>
														)}
														{slot.origin === 'manual' && (
															<IconButton
																size='small'
																color='secondary'
																onClick={() => unpinSlotAsAuto(slot)}
																title={'\u041f\u0435\u0440\u0435\u0432\u0435\u0441\u0442\u0438 \u0432 \u0430\u0432\u0442\u043e'}
															>
																<LockOpenIcon fontSize='small' />
															</IconButton>
														)}
														{/* Attendance quick actions */}
														{slot.slot_type === 'group' && (
															<Tooltip title='Посещаемость группы'>
																<IconButton size='small' color='info' onClick={() => setAttendanceDialog({ open: true, slot })}>
																	<AttendanceIcon fontSize='small' />
																</IconButton>
															</Tooltip>
														)}
														{slot.status !== 'cancelled' && (
															<Tooltip title='Отменить занятие'>
																<IconButton size='small' color='error' onClick={() => markSlotStatus(slot, 'cancelled')}>
																	<CancelSlotIcon fontSize='small' />
																</IconButton>
															</Tooltip>
														)}
														{slot.status === 'cancelled' && (
															<Tooltip title='Занятие всё же было — вернуть'>
																<IconButton size='small' color='success' onClick={() => markSlotStatus(slot, 'scheduled')}>
																	<ConductedIcon fontSize='small' />
																</IconButton>
															</Tooltip>
														)}
														<IconButton
															size='small'
															onClick={() => openEditSlot(slot)}
															title='Редактировать'
														>
															<EditIcon fontSize='small' />
														</IconButton>
														<IconButton
															size='small'
															color='error'
															onClick={() => deleteSlot(slot.id)}
															title='Удалить'
														>
															<DeleteIcon fontSize='small' />
														</IconButton>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</TableContainer>
							</Box>
						)
					})}

				{!loading && schedule && scheduleData?.slots?.length === 0 && (
					<Alert severity='warning'>
						Слоты в расписании отсутствуют. Попробуйте сгенерировать или
						добавить слоты вручную.
					</Alert>
				)}

				{/* Issues */}
				{!loading && issues.length > 0 && (() => {
					const handleIssueSortClick = col => {
						if (issueSortBy === col) {
							setIssueSortDir(d => d === 'asc' ? 'desc' : 'asc')
						} else {
							setIssueSortBy(col)
							setIssueSortDir('asc')
						}
					}

					const sortIssues = list => [...list].sort((a, b) => {
						let aVal = '', bVal = ''
						if (issueSortBy === 'student') {
							aVal = a.group_lesson_id ? (a.group_lesson?.name || '') : (a.student?.full_name || '')
							bVal = b.group_lesson_id ? (b.group_lesson?.name || '') : (b.student?.full_name || '')
						} else if (issueSortBy === 'teacher') {
							aVal = a.teacher?.full_name || ''
							bVal = b.teacher?.full_name || ''
						} else if (issueSortBy === 'reason') {
							aVal = a.message || ''
							bVal = b.message || ''
						} else {
							aVal = a.subject?.name || ''
							bVal = b.subject?.name || ''
						}
						const cmp = aVal.localeCompare(bVal, 'ru')
						return issueSortDir === 'asc' ? cmp : -cmp
					})

					const filtered = issues.filter(issue => {
						if (filterIssueStudentId && issue.student_id !== Number(filterIssueStudentId)) return false
						if (filterIssueTeacherId && issue.teacher_id !== Number(filterIssueTeacherId)) return false
						if (filterIssueFundingType) {
							const student = students.find(s => s.id === issue.student_id) || issue.student
							if (student?.funding_type !== filterIssueFundingType) return false
						}
						return true
					})

					const isConflict = issue => issue.message.startsWith('Все возможные')
					const configErrors = sortIssues(filtered.filter(i => !isConflict(i)))
					const conflicts = sortIssues(filtered.filter(i => isConflict(i)))

					const sortableHead = (
						<TableHead>
							<TableRow>
								<TableCell>
									<TableSortLabel
										active={issueSortBy === 'student'}
										direction={issueSortBy === 'student' ? issueSortDir : 'asc'}
										onClick={() => handleIssueSortClick('student')}
									>
										Ученик / Группа
									</TableSortLabel>
								</TableCell>
								<TableCell>
									<TableSortLabel
										active={issueSortBy === 'teacher'}
										direction={issueSortBy === 'teacher' ? issueSortDir : 'asc'}
										onClick={() => handleIssueSortClick('teacher')}
									>
										Преподаватель
									</TableSortLabel>
								</TableCell>
								<TableCell>
									<TableSortLabel
										active={issueSortBy === 'subject'}
										direction={issueSortBy === 'subject' ? issueSortDir : 'asc'}
										onClick={() => handleIssueSortClick('subject')}
									>
										Предмет
									</TableSortLabel>
								</TableCell>
								<TableCell>
										<TableSortLabel
											active={issueSortBy === 'reason'}
											direction={issueSortBy === 'reason' ? issueSortDir : 'asc'}
											onClick={() => handleIssueSortClick('reason')}
										>
											Причина
										</TableSortLabel>
									</TableCell>
							</TableRow>
						</TableHead>
					)

					const renderRows = list => list.map(issue => (
						<TableRow key={issue.id}>
							<TableCell>
								{issue.group_lesson_id
									? `Группа: ${issue.group_lesson?.name || issue.group_lesson_id}`
									: (issue.student?.full_name || issue.student_id || '—')}
							</TableCell>
							<TableCell>{issue.teacher?.full_name || issue.teacher_id || '—'}</TableCell>
							<TableCell>{issue.subject?.name || issue.subject_id || '—'}</TableCell>
							<TableCell>{issue.message}</TableCell>
						</TableRow>
					))

					return (
						<Accordion sx={{ mt: 2 }}>
							<AccordionSummary expandIcon={<ExpandIcon />}>
								<Typography color='error.main'>
									Проблемы при генерации ({issues.length})
								</Typography>
							</AccordionSummary>
							<AccordionDetails>
								{/* Filters */}
								<Grid container spacing={2} alignItems='center' sx={{ mb: 2 }}>
									<Grid item xs={12} sm={3}>
										<FormControl fullWidth size='small'>
											<InputLabel>Ученик</InputLabel>
											<Select value={filterIssueStudentId} label='Ученик' onChange={e => setFilterIssueStudentId(e.target.value)}>
												<MenuItem value=''>Все ученики</MenuItem>
												{students.map(s => <MenuItem key={s.id} value={s.id}>{s.full_name}</MenuItem>)}
											</Select>
										</FormControl>
									</Grid>
									<Grid item xs={12} sm={3}>
										<FormControl fullWidth size='small'>
											<InputLabel>Преподаватель</InputLabel>
											<Select value={filterIssueTeacherId} label='Преподаватель' onChange={e => setFilterIssueTeacherId(e.target.value)}>
												<MenuItem value=''>Все преподаватели</MenuItem>
												{teachers.map(t => <MenuItem key={t.id} value={t.id}>{t.full_name}</MenuItem>)}
											</Select>
										</FormControl>
									</Grid>
									<Grid item xs={12} sm={3}>
										<FormControl fullWidth size='small'>
											<InputLabel>Финансирование</InputLabel>
											<Select value={filterIssueFundingType} label='Финансирование' onChange={e => setFilterIssueFundingType(e.target.value)}>
												<MenuItem value=''>Все</MenuItem>
												<MenuItem value='paid'>Платники</MenuItem>
												<MenuItem value='budget'>Бюджетники</MenuItem>
											</Select>
										</FormControl>
									</Grid>
									<Grid item xs={12} sm={3}>
										<Button
											size='small'
											onClick={() => { setFilterIssueStudentId(''); setFilterIssueTeacherId(''); setFilterIssueFundingType('') }}
											disabled={!filterIssueStudentId && !filterIssueTeacherId && !filterIssueFundingType}
										>
											Сбросить фильтры
										</Button>
									</Grid>
								</Grid>

								{/* Category 1: config errors */}
								{configErrors.length > 0 && (
									<Box mb={3}>
										<Typography variant='subtitle2' color='warning.dark' sx={{ mb: 1 }}>
											Ошибки конфигурации — занятие невозможно поставить из-за неполных настроек ({configErrors.length})
										</Typography>
										<TableContainer>
											<Table size='small'>
												{sortableHead}
												<TableBody>{renderRows(configErrors)}</TableBody>
											</Table>
										</TableContainer>
									</Box>
								)}

								{/* Category 2: schedule conflicts */}
								{conflicts.length > 0 && (
									<Box>
										<Typography variant='subtitle2' color='error.main' sx={{ mb: 1 }}>
											Конфликты расписания — все слоты заняты другими занятиями ({conflicts.length})
										</Typography>
										<TableContainer>
											<Table size='small'>
												{sortableHead}
												<TableBody>{renderRows(conflicts)}</TableBody>
											</Table>
										</TableContainer>
									</Box>
								)}
							</AccordionDetails>
						</Accordion>
					)
				})()}
			</Paper>

			{/* Create Slot Dialog */}
			<Dialog
				open={createDialog}
				onClose={() => setCreateDialog(false)}
				maxWidth='sm'
				fullWidth
			>
				<DialogTitle>Добавить слот вручную</DialogTitle>
				<DialogContent>
					<Box display='flex' flexDirection='column' gap={2} sx={{ mt: 1 }}>
						<FormControl fullWidth>
							<InputLabel>Тип занятия</InputLabel>
							<Select
								value={slotForm.slot_type}
								label='Тип занятия'
								onChange={e =>
									setSlotForm({
										...slotForm,
										slot_type: e.target.value,
										assignment_id: '',
										group_lesson_id: '',
										student_id: '',
										teacher_id: '',
										subject_id: '',
									})
								}
							>
								<MenuItem value='individual'>Индивидуальное</MenuItem>
								<MenuItem value='group'>Групповое</MenuItem>
							</Select>
						</FormControl>
						{slotForm.slot_type === 'individual' && (
							<Autocomplete
								options={assignments}
								value={assignments.find(a => a.id === Number(slotForm.assignment_id)) || null}
								getOptionLabel={a =>
									a
										? `${a.student?.full_name || a.student_id} → ${a.teacher?.full_name || a.teacher_id} (${a.subject?.name || a.subject_id})`
										: ''
								}
								onChange={(event, value) =>
									setSlotForm({ ...slotForm, assignment_id: value?.id || '' })
								}
								renderInput={params => (
									<TextField {...params} label='Назначение' required />
								)}
							/>
						)}
						{slotForm.slot_type === 'individual' && !slotForm.assignment_id && (
							<>
								<Autocomplete
									options={students.filter(s => s.is_active)}
									value={students.find(s => s.id === Number(slotForm.student_id)) || null}
									getOptionLabel={s => s?.full_name || ''}
									onChange={(event, value) =>
										setSlotForm({ ...slotForm, student_id: value?.id || '' })
									}
									renderInput={params => (
										<TextField {...params} label={'\u0423\u0447\u0435\u043d\u0438\u043a'} required />
									)}
								/>
								<Autocomplete
									options={teachers.filter(t => t.is_active)}
									value={teachers.find(t => t.id === Number(slotForm.teacher_id)) || null}
									getOptionLabel={t => t?.full_name || ''}
									onChange={(event, value) =>
										setSlotForm({ ...slotForm, teacher_id: value?.id || '' })
									}
									renderInput={params => (
										<TextField {...params} label={'\u041f\u0440\u0435\u043f\u043e\u0434\u0430\u0432\u0430\u0442\u0435\u043b\u044c'} required />
									)}
								/>
								<Autocomplete
									options={subjects}
									value={subjects.find(s => s.id === Number(slotForm.subject_id)) || null}
									getOptionLabel={s => s?.name || ''}
									onChange={(event, value) =>
										setSlotForm({ ...slotForm, subject_id: value?.id || '' })
									}
									renderInput={params => (
										<TextField {...params} label={'\u041f\u0440\u0435\u0434\u043c\u0435\u0442'} required />
									)}
								/>
								<Alert severity='info'>Если назначения нет, система предложит создать его перед добавлением занятия.</Alert>
							</>
						)}
						{slotForm.slot_type === 'group' && (
							<>
								<Autocomplete
									options={groupLessons}
									value={groupLessons.find(g => g.id === Number(slotForm.group_lesson_id)) || null}
									getOptionLabel={g =>
										g ? `${g.name} (${g.subject?.name || g.subject_id}, ${g.enrollments?.length || 0} уч.)` : ''
									}
								onChange={(event, value) =>
									setSlotForm({
										...slotForm,
										group_lesson_id: value?.id || '',
										subject_id: value?.subject_id || '',
										teacher_id: value?.default_teacher_id || '',
										room_name: value?.room_name || '',
									})
								}
									renderInput={params => (
										<TextField {...params} label='Группа' required />
									)}
								/>
								<FormControl fullWidth required>
									<InputLabel>Преподаватель</InputLabel>
									<Select
										value={slotForm.teacher_id}
										label='Преподаватель'
										onChange={e => setSlotForm({ ...slotForm, teacher_id: e.target.value })}
									>
										{teachers.filter(t => t.is_active).map(t => (
											<MenuItem key={t.id} value={t.id}>
												{t.full_name}
											</MenuItem>
										))}
									</Select>
								</FormControl>
							</>
						)}
						{slotForm.slot_type === 'group' ? (
							<TextField
								label='Кабинет / место проведения'
								value={slotForm.room_name}
								onChange={e => setSlotForm({ ...slotForm, room_name: e.target.value })}
								fullWidth
								required
							/>
						) : (
							<Autocomplete
								options={rooms}
								value={rooms.find(r => r.id === Number(slotForm.room_id)) || null}
								getOptionLabel={r => r?.name || ''}
								onChange={(event, value) => setSlotForm({ ...slotForm, room_id: value?.id || '' })}
								renderInput={params => (
									<TextField {...params} label='Кабинет' required />
								)}
							/>
						)}
						<FormControl fullWidth>
							<InputLabel>День недели</InputLabel>
							<Select
								value={slotForm.weekday}
								label='День недели'
								onChange={e =>
									setSlotForm({ ...slotForm, weekday: e.target.value })
								}
							>
								{Object.entries(WEEKDAY_NAMES).map(([k, v]) => (
									<MenuItem key={k} value={Number(k)}>
										{v}
									</MenuItem>
								))}
							</Select>
						</FormControl>
						<Box display='flex' gap={2}>
							<TextField
								label='Начало (ЧЧ:ММ)'
								value={slotForm.start_time}
								onChange={e =>
									setSlotForm({ ...slotForm, start_time: e.target.value })
								}
								fullWidth
								placeholder='09:00'
							/>
							<TextField
								label='Конец (ЧЧ:ММ)'
								value={slotForm.end_time}
								onChange={e =>
									setSlotForm({ ...slotForm, end_time: e.target.value })
								}
								fullWidth
								placeholder='09:50'
							/>
						</Box>
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setCreateDialog(false)}>Отмена</Button>
					<Button onClick={createSlot} variant='contained'>
						Добавить
					</Button>
				</DialogActions>
			</Dialog>

			{/* Edit Slot Dialog */}
			<Dialog
				open={editDialog.open}
				onClose={() => setEditDialog({ open: false, slot: null })}
				maxWidth='sm'
				fullWidth
			>
				<DialogTitle>
					{editDialog.slot?.slot_type === 'group'
						? `Групповое занятие: ${editDialog.slot?.group_lesson?.name || ''}`
						: 'Редактировать слот'}
				</DialogTitle>
				<DialogContent>
					<Box display='flex' flexDirection='column' gap={2} sx={{ mt: 1 }}>
						<FormControl fullWidth>
							<InputLabel>День недели</InputLabel>
							<Select
								value={editForm.weekday}
								label='День недели'
								onChange={e =>
									setEditForm({ ...editForm, weekday: e.target.value })
								}
							>
								{Object.entries(WEEKDAY_NAMES).map(([k, v]) => (
									<MenuItem key={k} value={Number(k)}>
										{v}
									</MenuItem>
								))}
							</Select>
						</FormControl>
						<Box display='flex' gap={2}>
							<TextField
								label='Начало (ЧЧ:ММ)'
								value={editForm.start_time}
								onChange={e =>
									setEditForm({ ...editForm, start_time: e.target.value })
								}
								fullWidth
							/>
							<TextField
								label='Конец (ЧЧ:ММ)'
								value={editForm.end_time}
								onChange={e =>
									setEditForm({ ...editForm, end_time: e.target.value })
								}
								fullWidth
							/>
						</Box>
						<FormControl fullWidth>
							<InputLabel>Кабинет</InputLabel>
							<Select
								value={editForm.room_id}
								label='Кабинет'
								onChange={e =>
									setEditForm({ ...editForm, room_id: e.target.value })
								}
							>
								{rooms.map(r => (
									<MenuItem key={r.id} value={r.id}>
										{r.name}
									</MenuItem>
								))}
							</Select>
						</FormControl>
						<FormControl fullWidth>
							<InputLabel>Статус</InputLabel>
							<Select
								value={editForm.status}
								label='Статус'
								onChange={e =>
									setEditForm({ ...editForm, status: e.target.value })
								}
							>
								<MenuItem value='scheduled'>Запланировано</MenuItem>
								<MenuItem value='conducted'>Проведено</MenuItem>
								<MenuItem value='moved'>Перенесено</MenuItem>
								<MenuItem value='cancelled'>Отменено</MenuItem>
							</Select>
						</FormControl>

						{/* Group slot: enrollment + exclusion management */}
						{editDialog.slot?.slot_type === 'group' && (
							<>
								<Divider />
								<Typography variant='subtitle2'>
									Состав группы на это занятие
								</Typography>
								{(!editDialog.slot.group_lesson?.enrollments ||
									editDialog.slot.group_lesson.enrollments.length === 0) && (
									<Typography variant='body2' color='text.secondary'>
										В группе нет учеников
									</Typography>
								)}
								<Box display='flex' gap={1} alignItems='center'>
									<Autocomplete
										fullWidth
										size='small'
										options={students.filter(s =>
											!(editDialog.slot.group_lesson?.enrollments || []).some(enr => enr.student_id === s.id)
										)}
										value={students.find(s => s.id === Number(addGroupStudentId)) || null}
										getOptionLabel={s => s?.full_name || ''}
										onChange={(event, value) => setAddGroupStudentId(value?.id || '')}
										renderInput={params => (
											<TextField {...params} label='Добавить ученика' />
										)}
									/>
									<Button
										variant='outlined'
										onClick={handleAddStudentToGroupSlot}
										disabled={!addGroupStudentId}
									>
										Добавить
									</Button>
								</Box>
								<List dense disablePadding>
									{(editDialog.slot.group_lesson?.enrollments || []).map(enr => {
										const isExcluded = editDialog.slot.exclusions?.some(
											ex => ex.student_id === enr.student_id,
										)
										return (
											<ListItem key={enr.id} disableGutters>
												<ListItemText
													primary={enr.student?.full_name || enr.student_id}
													secondary={isExcluded ? 'Исключён из этого занятия' : 'Присутствует'}
													primaryTypographyProps={{
														sx: isExcluded
															? { textDecoration: 'line-through', color: 'text.secondary' }
															: {},
													}}
												/>
												<ListItemSecondaryAction>
													{isExcluded ? (
														<Tooltip title='Вернуть на занятие'>
															<IconButton
																size='small'
																color='success'
																onClick={() =>
																	handleIncludeStudent(editDialog.slot, enr.student_id)
																}
															>
																<IncludeIcon fontSize='small' />
															</IconButton>
														</Tooltip>
													) : (
														<Tooltip title='Исключить из занятия'>
															<IconButton
																size='small'
																color='warning'
																onClick={() =>
																	handleExcludeStudent(editDialog.slot, enr.student_id)
																}
															>
																<ExcludeIcon fontSize='small' />
															</IconButton>
														</Tooltip>
													)}
												</ListItemSecondaryAction>
											</ListItem>
										)
									})}
								</List>
							</>
						)}
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setEditDialog({ open: false, slot: null })}>
						Отмена
					</Button>
					<Button onClick={saveEditSlot} variant='contained'>
						Сохранить
					</Button>
				</DialogActions>
			</Dialog>

			{/* Past Week Confirmation Dialog */}
			<Dialog
				open={pastWeekConfirm.open}
				onClose={() => setPastWeekConfirm({ open: false, message: '' })}
				maxWidth='xs'
				fullWidth
			>
				<DialogTitle sx={{ color: 'warning.main' }}>⚠ Прошедшая неделя</DialogTitle>
				<DialogContent>
					<Typography>{pastWeekConfirm.message}</Typography>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setPastWeekConfirm({ open: false, message: '' })}>Отмена</Button>
					<Button
						variant='contained'
						color='warning'
						disabled={pastWeekCountdown > 0}
						onClick={confirmPastWeekAction}
					>
						{pastWeekCountdown > 0 ? `Подтвердить (${pastWeekCountdown})` : 'Подтвердить'}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Attendance Dialog for group slots */}
			<Dialog
				open={attendanceDialog.open}
				onClose={() => setAttendanceDialog({ open: false, slot: null })}
				maxWidth='xs'
				fullWidth
			>
				<DialogTitle>
					Посещаемость
					<Typography variant='caption' display='block' color='text.secondary'>
						{attendanceDialog.slot?.group_lesson?.name} · {WEEKDAY_NAMES[attendanceDialog.slot?.weekday]} {attendanceDialog.slot?.start_time}–{attendanceDialog.slot?.end_time}
					</Typography>
				</DialogTitle>
				<DialogContent>
					{(!attendanceDialog.slot?.group_lesson?.enrollments || attendanceDialog.slot.group_lesson.enrollments.length === 0) && (
						<Typography variant='body2' color='text.secondary'>В группе нет учеников</Typography>
					)}
					<List dense disablePadding>
						{(attendanceDialog.slot?.group_lesson?.enrollments || []).map(enr => {
							const isAbsent = attendanceDialog.slot?.exclusions?.some(ex => ex.student_id === enr.student_id)
							return (
								<ListItem key={enr.id} disableGutters>
									<ListItemText
										primary={enr.student?.full_name || `Ученик #${enr.student_id}`}
										secondary={isAbsent ? 'Отсутствовал' : 'Присутствовал'}
										primaryTypographyProps={{ sx: isAbsent ? { color: 'text.secondary', textDecoration: 'line-through' } : {} }}
										secondaryTypographyProps={{ color: isAbsent ? 'error' : 'success.main' }}
									/>
									<ListItemSecondaryAction>
										<Tooltip title={isAbsent ? 'Отметить присутствие' : 'Отметить отсутствие'}>
											<IconButton
												size='small'
												color={isAbsent ? 'success' : 'error'}
												onClick={() => handleToggleAttendance(enr.student_id, isAbsent)}
											>
												{isAbsent ? <IncludeIcon fontSize='small' /> : <ExcludeIcon fontSize='small' />}
											</IconButton>
										</Tooltip>
									</ListItemSecondaryAction>
								</ListItem>
							)
						})}
					</List>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setAttendanceDialog({ open: false, slot: null })}>Закрыть</Button>
				</DialogActions>
			</Dialog>

			{/* Conflict Warning Dialog */}
			<Dialog
				open={conflictDialog.open}
				onClose={() => setConflictDialog({ open: false, conflicts: [], deleteConflicts: true })}
				maxWidth='sm'
				fullWidth
			>
				<DialogTitle>Конфликт занятий</DialogTitle>
				<DialogContent>
					<Typography variant='body2' gutterBottom>
						Новое занятие пересекается со следующими занятиями:
					</Typography>
					<List dense>
						{conflictDialog.conflicts.map(s => (
							<ListItem key={s.id} disableGutters>
								<ListItemText primary={describeConflictingSlot(s)} />
							</ListItem>
						))}
					</List>
					<FormControlLabel
						control={
							<Checkbox
								checked={conflictDialog.deleteConflicts}
								onChange={e =>
									setConflictDialog(prev => ({ ...prev, deleteConflicts: e.target.checked }))
								}
							/>
						}
						label='Удалить конфликтующее занятие'
					/>
				</DialogContent>
				<DialogActions>
					<Button
						onClick={() =>
							setConflictDialog({ open: false, conflicts: [], deleteConflicts: true })
						}
					>
						Отмена
					</Button>
					<Button onClick={handleConflictConfirm} variant='contained' color='error'>
						Поставить занятие
					</Button>
				</DialogActions>
			</Dialog>

			{/* Approve: conflicts exist dialog */}
			<Dialog
				open={approveConflictDialog.open}
				onClose={() => setApproveConflictDialog({ open: false, pairs: [] })}
				maxWidth='sm'
				fullWidth
			>
				<DialogTitle>Нельзя утвердить: есть конфликты</DialogTitle>
				<DialogContent>
					<Alert severity='error' sx={{ mb: 2 }}>
						Найдено {approveConflictDialog.pairs.length} конфликтующих пар занятий. Исправьте их перед утверждением.
					</Alert>
					<List dense>
						{approveConflictDialog.pairs.map(({ a, b }, i) => (
							<ListItem key={i} disableGutters sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
								<ListItemText
									primary={`Конфликт ${i + 1}`}
									secondary={
										<>
											<span style={{ display: 'block' }}>• {describeConflictingSlot(a)}</span>
											<span style={{ display: 'block' }}>• {describeConflictingSlot(b)}</span>
										</>
									}
								/>
								<Divider sx={{ width: '100%', mt: 1 }} />
							</ListItem>
						))}
					</List>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setApproveConflictDialog({ open: false, pairs: [] })}>
						Закрыть
					</Button>
				</DialogActions>
			</Dialog>

			{/* Delete manual slots confirmation dialog */}
			<Dialog
				open={deleteManualDialog.open}
				onClose={closeDeleteManualDialog}
				maxWidth='xs'
				fullWidth
			>
				<DialogTitle>Удалить ручные слоты?</DialogTitle>
				<DialogContent>
					<Typography variant='body2'>
						Вы уверены, что хотите удалить все ручные слоты? Авто-слоты останутся без изменений.
					</Typography>
				</DialogContent>
				<DialogActions>
					<Button onClick={closeDeleteManualDialog}>Отмена</Button>
					<Button
						variant='contained'
						color='error'
						onClick={doDeleteManualSlots}
						disabled={deleteManualDialog.countdown > 0}
					>
						{deleteManualDialog.countdown > 0
							? `Удалить (${deleteManualDialog.countdown})`
							: 'Удалить'}
					</Button>
				</DialogActions>
			</Dialog>
		</Container>
	)
}

export default AdminSchedule
