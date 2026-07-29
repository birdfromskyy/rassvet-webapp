import './AdminModule.scss'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import ExcelJS from 'exceljs'
import { useNavigate } from 'react-router-dom'
import {
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
	Checkbox,
	FormControlLabel,
	Autocomplete,
	Popper,
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
import commercialTariffService from '../services/commercialTariffService'
import api from '../services/api'
import './AdminSchedule.scss'

// Makes Autocomplete dropdown at least as wide as input (same behavior as Select)
const WidePopper = ({ style, ...props }) => (
	<Popper {...props} style={{ ...style, width: 'auto', minWidth: style?.width ?? 0 }} />
)

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

const getSlotTeacherEntries = slot => {
	if (slot?.slot_type === 'group' && Array.isArray(slot.teachers) && slot.teachers.length) {
		return slot.teachers.map(link => link.teacher || { id: link.teacher_id })
	}
	return slot?.teacher ? [slot.teacher] : (slot?.teacher_id ? [{ id: slot.teacher_id }] : [])
}

const getSlotTeacherLabel = slot => getSlotTeacherEntries(slot)
	.map(teacher => teacher.full_name || `ID ${teacher.id}`)
	.join(', ') || '—'
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
	teacher_id: '',
	teacher_ids: [],
	teacher_hours_mode: 'full',
	room_id: '',
	room_name: '',
	weekday: 1,
	start_time: '09:00',
	end_time: '09:50',
	ignore_student_windows: false,
}

const EMPTY_EDIT_FORM = {
	weekday: 1,
	start_time: '09:00',
	end_time: '09:50',
	room_id: '',
	room_name: '',
	status: 'scheduled',
	teacher_ids: [],
	teacher_hours_mode: 'full',
	ignore_student_windows: false,
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

const formatDateISO = date => {
	const y = date.getFullYear()
	const m = String(date.getMonth() + 1).padStart(2, '0')
	const d = String(date.getDate()).padStart(2, '0')
	return `${y}-${m}-${d}`
}

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
	const [attendanceDialog, setAttendanceDialog] = useState({ open: false, slot: null, attendance: [], loading: false })

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
	const [hideResolvedDiagnostics, setHideResolvedDiagnostics] = useState(false)
	const [refreshingDiagnostics, setRefreshingDiagnostics] = useState(false)

	// Issue sorting

	// Create slot dialog
	const [createDialog, setCreateDialog] = useState(false)
	const [slotForm, setSlotForm] = useState(EMPTY_SLOT_FORM)
	const [groupDurationConfirm, setGroupDurationConfirm] = useState({ open: false, expected: 0, actual: 0, start: '', end: '' })
	const [reportTariffConfirm, setReportTariffConfirm] = useState({ open: false, preview: null, subjectName: '', action: 'create' })
	const pendingReportTariffAction = useRef(null)
	const reportTariffAcknowledged = useRef(false)

	// Edit slot dialog
	const [editDialog, setEditDialog] = useState({ open: false, slot: null, groupAttendance: [], groupAttendanceLoading: false })
	const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM)
	const [addGroupStudentId, setAddGroupStudentId] = useState('')

	// Conflict warning dialog
	const [conflictDialog, setConflictDialog] = useState({ open: false, conflicts: [], warnings: [], deleteConflicts: true })
	const pendingSlotAction = useRef(null)

	// Approve-blocking conflict dialog
	const [approveConflictDialog, setApproveConflictDialog] = useState({ open: false, pairs: [] })

	// Clear auto slots confirmation dialog
	const [clearAutoDialog, setClearAutoDialog] = useState({ open: false, countdown: 3 })
	const clearAutoTimerRef = useRef(null)
	// Clear manual slots confirmation dialog
	const [deleteManualDialog, setDeleteManualDialog] = useState({ open: false, countdown: 3 })
	// Delete single slot confirmation dialog
	const [deleteSlotDialog, setDeleteSlotDialog] = useState({ open: false, slotId: null, slotLabel: '' })
	const deleteManualTimerRef = useRef(null)
	// Bulk origin change dialog
	const [bulkOriginDialog, setBulkOriginDialog] = useState({ open: false, origin: 'manual', countdown: 3 })
	const bulkOriginTimerRef = useRef(null)

	// Generation settings
	const [maxGapMinutes, setMaxGapMinutes] = useState(30)
	const [maxGapSaved, setMaxGapSaved] = useState(false)
	const [teacherGapMinutes, setTeacherGapMinutes] = useState(10)
	const [teacherGapSaved, setTeacherGapSaved] = useState(false)

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

	const refreshDiagnostics = async event => {
		event?.stopPropagation()
		if (!scheduleData?.schedule?.id || refreshingDiagnostics) return
		setRefreshingDiagnostics(true)
		try {
			const data = await scheduleService.refreshScheduleDiagnostics(scheduleData.schedule.id)
			setScheduleData(data)
			setHideResolvedDiagnostics(false)
			toast.success('Диагностика расписания обновлена')
		} catch (e) {
			toast.error(e.response?.data?.error || 'Не удалось обновить диагностику')
		} finally {
			setRefreshingDiagnostics(false)
		}
	}

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

	useEffect(() => {
		api.get('/site-settings/max_student_gap_minutes')
			.then(r => { if (r.data?.value) setMaxGapMinutes(Number(r.data.value)) })
			.catch(() => {})
		api.get('/site-settings/teacher_gap_minutes')
			.then(r => { if (r.data?.value) setTeacherGapMinutes(Number(r.data.value)) })
			.catch(() => {})
	}, [])

	const saveMaxGapMinutes = async val => {
		try {
			await api.put('/admin/site-settings', { key: 'max_student_gap_minutes', value: String(val) })
			setMaxGapSaved(true)
			setTimeout(() => setMaxGapSaved(false), 2000)
		} catch {
			toast.error('Не удалось сохранить настройку')
		}
	}

	const saveTeacherGapMinutes = async val => {
		try {
			await api.put('/admin/site-settings', { key: 'teacher_gap_minutes', value: String(val) })
			setTeacherGapSaved(true)
			setTimeout(() => setTeacherGapSaved(false), 2000)
		} catch {
			toast.error('Не удалось сохранить настройку')
		}
	}

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
				toast.success(successMessage)
				loadSchedule()
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
		if (maxGapMinutes < 10) {
			toast.error('Минимальное значение для «Макс. перерыв у ученика» — 10 мин.')
			return
		}
		if (teacherGapMinutes < 10) {
			toast.error('Минимальное значение для «Макс. перерыв у преподавателя» — 10 мин.')
			return
		}
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
				if (!(aStart < bEnd && aEnd > bStart)) continue
			const sameTeacher = getSlotTeacherIds(a).some(id => getSlotTeacherIds(b).includes(id))
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
		if (maxGapMinutes < 10 || teacherGapMinutes < 10) {
			toast.error('Для генерации «Макс. перерыв у ученика» и «Макс. перерыв у преподавателя» должны быть не меньше 10 мин.')
			return
		}
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
		} else if (isCurrentWeek) {
			openPastWeekConfirm('Удалить авто-слоты текущей недели и перегенерировать? Ручные слоты сохранятся.', doIt)
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

	const openClearAutoDialog = () => {
		setClearAutoDialog({ open: true, countdown: 3 })
		let count = 3
		clearAutoTimerRef.current = setInterval(() => {
			count -= 1
			setClearAutoDialog(prev => ({ ...prev, countdown: count }))
			if (count <= 0) {
				clearInterval(clearAutoTimerRef.current)
				clearAutoTimerRef.current = null
			}
		}, 1000)
	}

	const closeClearAutoDialog = () => {
		if (clearAutoTimerRef.current) {
			clearInterval(clearAutoTimerRef.current)
			clearAutoTimerRef.current = null
		}
		setClearAutoDialog({ open: false, countdown: 3 })
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
		setDeleteManualDialog({ open: true, countdown: 3 })
		let count = 3
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
		setDeleteManualDialog({ open: false, countdown: 3 })
	}

	const doDeleteManualSlots = async () => {
		closeDeleteManualDialog()
		try {
			const data = await scheduleService.clearManualSlots(scheduleData.schedule.id)
			setScheduleData(data)
			toast.success('Ручные слоты очищены')
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка удаления ручных слотов')
		}
	}

	const openBulkOriginDialog = (origin) => {
		setBulkOriginDialog({ open: true, origin, countdown: 3 })
		let count = 3
		bulkOriginTimerRef.current = setInterval(() => {
			count -= 1
			setBulkOriginDialog(prev => ({ ...prev, countdown: count }))
			if (count <= 0) {
				clearInterval(bulkOriginTimerRef.current)
				bulkOriginTimerRef.current = null
			}
		}, 1000)
	}

	const closeBulkOriginDialog = () => {
		if (bulkOriginTimerRef.current) {
			clearInterval(bulkOriginTimerRef.current)
			bulkOriginTimerRef.current = null
		}
		setBulkOriginDialog({ open: false, origin: 'manual', countdown: 3 })
	}

	const confirmBulkOrigin = async () => {
		const { origin } = bulkOriginDialog
		closeBulkOriginDialog()
		try {
			const data = await scheduleService.bulkUpdateSlotsOrigin(scheduleData.schedule.id, origin)
			setScheduleData(data)
			toast.success(origin === 'manual' ? 'Все занятия переведены в ручной режим' : 'Все занятия переведены в авто режим')
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка изменения происхождения')
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
			for (const teacher of getSlotTeacherEntries(slot)) {
				const name = teacher.full_name || `ID ${teacher.id}`
				if (!slotsByTeacher[name]) slotsByTeacher[name] = []
				slotsByTeacher[name].push(slot)
			}
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
					getSlotTeacherLabel(slot),
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
		reportTariffAcknowledged.current = false
		setCreateDialog(true)
		// Refresh group lessons to get the latest default_teacher_id
		scheduleService.getGroupLessons({ status: 'active' }).then(setGroupLessons).catch(() => {})
	}

	const confirmReportTariffBeforeAction = async (input, subjectName, action, dialogAction = 'create') => {
		try {
			const preview = await commercialTariffService.previewReportTariff(input)
			if (preview.covered) {
				await action()
				return
			}
			pendingReportTariffAction.current = action
			setReportTariffConfirm({ open: true, preview, subjectName, action: dialogAction })
		} catch (e) {
			toast.error(e.response?.data?.error || 'Не удалось проверить тариф для отчётности')
		}
	}

	const acknowledgeMissingReportTariff = async () => {
		reportTariffAcknowledged.current = true
		const action = pendingReportTariffAction.current
		pendingReportTariffAction.current = null
		setReportTariffConfirm({ open: false, preview: null, subjectName: '', action: 'create' })
		if (action) await action()
	}

	const closeReportTariffConfirm = () => {
		pendingReportTariffAction.current = null
		setReportTariffConfirm({ open: false, preview: null, subjectName: '', action: 'create' })
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

			const payload = slotForm.slot_type === 'group'
				? {
					slot_type: 'group',
					group_lesson_id: Number(slotForm.group_lesson_id),
					teacher_ids: (slotForm.teacher_ids.length ? slotForm.teacher_ids : (groupLesson.teachers || []).map(link => link.teacher_id)).map(Number),
					teacher_hours_mode: slotForm.teacher_hours_mode || groupLesson.teacher_hours_mode || 'full',
					room_name: slotForm.room_name || groupLesson.room_name,
					weekday: Number(slotForm.weekday),
					start_time: slotForm.start_time,
					end_time: slotForm.end_time,
					acknowledge_missing_report_tariff: reportTariffAcknowledged.current,
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
					acknowledge_missing_report_tariff: reportTariffAcknowledged.current,
				}
			if (slotForm.slot_type === 'group' && groupLesson && slotForm.ignore_student_windows !== groupLesson.ignore_student_windows) {
				await scheduleService.updateGroupLesson(groupLesson.id, { ignore_student_windows: slotForm.ignore_student_windows })
			}
			await scheduleService.createSlot(scheduleId, payload, force)
			toast.success('Слот добавлен')
			reportTariffAcknowledged.current = false
			setCreateDialog(false)
			loadSchedule()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка создания слота')
		}
	}

	const createSlot = async (skipGroupDurationConfirm = false) => {
		if (slotForm.slot_type === 'group') {
			const groupLesson = groupLessons.find(g => g.id === Number(slotForm.group_lesson_id))
			if (!groupLesson) {
				toast.error('Выберите групповое занятие')
				return
			}
			const teacherIds = slotForm.teacher_ids.length ? slotForm.teacher_ids : (groupLesson.teachers || []).map(link => link.teacher_id)
			if (!teacherIds.length) {
				toast.error('Выберите хотя бы одного преподавателя')
				return
			}
			if (!String(slotForm.room_name || groupLesson.room_name || '').trim()) {
				toast.error('Укажите кабинет или место проведения')
				return
			}
			const actualDuration = timeToMinutes(slotForm.end_time) - timeToMinutes(slotForm.start_time)
			const expectedDuration = Number(groupLesson.duration_min)
			if (!skipGroupDurationConfirm && expectedDuration > 0 && actualDuration > 0 && actualDuration !== expectedDuration) {
				setGroupDurationConfirm({
					open: true,
					expected: expectedDuration,
					actual: actualDuration,
					start: slotForm.start_time,
					end: slotForm.end_time,
				})
				return
			}
			await confirmReportTariffBeforeAction({
				slot_type: 'group', start_time: slotForm.start_time, end_time: slotForm.end_time,
			}, groupLesson.name || 'Групповое занятие', async () => {
				const conflicts = findConflictingSlots(
					Number(slotForm.weekday), slotForm.start_time, slotForm.end_time,
					null, teacherIds,
					(groupLesson.enrollments || []).map(enr => enr.student_id),
				)
				if (conflicts.length > 0) {
					pendingSlotAction.current = doCreateSlot
					setConflictDialog({ open: true, conflicts, warnings: [], deleteConflicts: true })
					return
				}
				await doCreateSlot()
			})
			return
		}

		const assignment = assignments.find(a => a.id === Number(slotForm.assignment_id))
		if (!assignment) {
			toast.error('Выберите назначение')
			return
		}
		if (!slotForm.room_id) {
			toast.error('Выберите кабинет для занятия')
			return
		}
		await confirmReportTariffBeforeAction({
			slot_type: 'individual', subject_id: assignment.subject_id,
			start_time: slotForm.start_time, end_time: slotForm.end_time,
		}, assignment.subject?.name || 'Выбранный предмет', async () => {
			const conflicts = findConflictingSlots(
				Number(slotForm.weekday), slotForm.start_time, slotForm.end_time,
				Number(slotForm.room_id), assignment.teacher_id, [assignment.student_id],
			)
			const warnings = checkAvailabilityWarnings(
				Number(slotForm.weekday), slotForm.start_time, slotForm.end_time, assignment,
			)
			if (conflicts.length > 0 || warnings.length > 0) {
				pendingSlotAction.current = doCreateSlot
				setConflictDialog({ open: true, conflicts, warnings, deleteConflicts: conflicts.length > 0 })
				return
			}
			await doCreateSlot()
		})
	}
	const openEditSlot = async slot => {
		reportTariffAcknowledged.current = false
		setEditForm({
			weekday: slot.weekday,
			start_time: slot.start_time,
			end_time: slot.end_time,
			room_id: slot.room_id,
			room_name: slot.room_name || slot.group_lesson?.room_name || '',
			status: slot.status,
			teacher_ids: getSlotTeacherIds(slot),
			teacher_hours_mode: slot.teacher_hours_mode || slot.group_lesson?.teacher_hours_mode || 'full',
			ignore_student_windows: slot.group_lesson?.ignore_student_windows || false,
		})
		setAddGroupStudentId('')
		setEditDialog({ open: true, slot, groupAttendance: [], groupAttendanceLoading: slot.slot_type === 'group' })
		if (slot.slot_type === 'group') {
			try {
				const att = await scheduleService.getSlotAttendance(scheduleData.schedule.id, slot.id)
				setEditDialog(prev => ({ ...prev, groupAttendance: att, groupAttendanceLoading: false }))
			} catch {
				setEditDialog(prev => ({ ...prev, groupAttendanceLoading: false }))
			}
		}
	}

	const doSaveEditSlot = async (force = false) => {
		try {
			const slot = editDialog.slot
			const { teacher_hours_mode, teacher_ids, ...basePayload } = editForm
			const payload = slot.slot_type === 'group'
				? { ...basePayload, teacher_ids, teacher_hours_mode, acknowledge_missing_report_tariff: reportTariffAcknowledged.current }
				: { ...basePayload, acknowledge_missing_report_tariff: reportTariffAcknowledged.current }
			if (slot.slot_type === 'group' && slot.group_lesson && editForm.ignore_student_windows !== slot.group_lesson.ignore_student_windows) {
				await scheduleService.updateGroupLesson(slot.group_lesson.id, { ignore_student_windows: editForm.ignore_student_windows })
			}
			await scheduleService.updateSlot(scheduleData.schedule.id, slot.id, payload, force)
			toast.success('Слот обновлён')
			reportTariffAcknowledged.current = false
			setEditDialog({ open: false, slot: null, groupAttendance: [], groupAttendanceLoading: false })
			loadSchedule()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка обновления')
		}
	}

	const saveEditSlot = async () => {
		const slot = editDialog.slot
		const proceed = async () => {
			const conflicts = findConflictingSlots(
				editForm.weekday,
				editForm.start_time,
				editForm.end_time,
				slot?.slot_type === 'group' ? null : editForm.room_id,
				slot?.slot_type === 'group' ? editForm.teacher_ids : getSlotTeacherIds(slot),
				getSlotStudentIds(slot),
				slot?.id,
			)
			if (conflicts.length > 0) {
				pendingSlotAction.current = doSaveEditSlot
				setConflictDialog({ open: true, conflicts, warnings: [], deleteConflicts: true })
				return
			}
			await doSaveEditSlot()
		}
		const durationChanged = slot && (slot.start_time !== editForm.start_time || slot.end_time !== editForm.end_time)
		if (!durationChanged) {
			await proceed()
			return
		}
		await confirmReportTariffBeforeAction({
			slot_type: slot.slot_type,
			subject_id: slot.slot_type === 'individual' ? slot.subject_id : undefined,
			start_time: editForm.start_time,
			end_time: editForm.end_time,
		}, slot.slot_type === 'group' ? (slot.group_lesson?.name || 'Групповое занятие') : (slot.subject?.name || 'Выбранный предмет'), proceed, 'save')
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
	const confirmDeleteSlot = slot => {
		const label = slot.slot_type === 'group'
			? `Групповое занятие «${slot.group_lesson?.name || '—'}»`
			: `${slot.student?.full_name || '—'} · ${slot.subject?.name || '—'}`
		setDeleteSlotDialog({ open: true, slotId: slot.id, slotLabel: label })
	}

	const deleteSlot = async () => {
		const slotId = deleteSlotDialog.slotId
		setDeleteSlotDialog({ open: false, slotId: null, slotLabel: '' })
		try {
			await scheduleService.deleteSlot(scheduleData.schedule.id, slotId)
			toast.success('Слот удалён')
			loadSchedule()
		} catch {
			toast.error('Ошибка удаления')
		}
	}

	const handleAddToEditSession = async studentId => {
		const slot = editDialog.slot
		const id = Number(studentId || addGroupStudentId)
		if (!id) return
		try {
			const rec = await scheduleService.addSlotStudent(scheduleData.schedule.id, slot.id, id)
			setEditDialog(prev => ({ ...prev, groupAttendance: [...prev.groupAttendance, rec] }))
			setAddGroupStudentId('')
			toast.success('Ученик добавлен в занятие')
		} catch (e) {
			toast.error(e.response?.data?.error || 'Уже в занятии или ошибка')
		}
	}

	const handleRemoveFromEditSession = async studentId => {
		const slot = editDialog.slot
		try {
			await scheduleService.removeSlotStudent(scheduleData.schedule.id, slot.id, studentId)
			setEditDialog(prev => ({ ...prev, groupAttendance: prev.groupAttendance.filter(r => r.student_id !== studentId) }))
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка')
		}
	}

	const openAttendanceDialog = async slot => {
		setAttendanceDialog({ open: true, slot, attendance: [], loading: true })
		try {
			const att = await scheduleService.getSlotAttendance(scheduleData.schedule.id, slot.id)
			setAttendanceDialog(prev => ({ ...prev, attendance: att, loading: false }))
		} catch {
			setAttendanceDialog(prev => ({ ...prev, loading: false }))
		}
	}

	const handleToggleAttendance = async record => {
		const slot = attendanceDialog.slot
		const newVal = record.attended === false ? true : false
		try {
			await scheduleService.updateAttendance(scheduleData.schedule.id, slot.id, record.student_id, newVal)
			setAttendanceDialog(prev => ({
				...prev,
				attendance: prev.attendance.map(r =>
					r.student_id === record.student_id ? { ...r, attended: newVal } : r
				),
			}))
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка')
		}
	}

	const handleAddToSession = async studentId => {
		const slot = attendanceDialog.slot
		try {
			const rec = await scheduleService.addSlotStudent(scheduleData.schedule.id, slot.id, Number(studentId))
			setAttendanceDialog(prev => ({ ...prev, attendance: [...prev.attendance, rec] }))
			toast.success('Ученик добавлен в занятие')
		} catch (e) {
			toast.error(e.response?.data?.error || 'Уже в занятии или ошибка')
		}
	}

	const handleRemoveFromSession = async studentId => {
		const slot = attendanceDialog.slot
		try {
			await scheduleService.removeSlotStudent(scheduleData.schedule.id, slot.id, studentId)
			setAttendanceDialog(prev => ({
				...prev,
				attendance: prev.attendance.filter(r => r.student_id !== studentId),
			}))
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка')
		}
	}


	const timeToMinutes = t => {
		const [h, m] = t.split(':').map(Number)
		return h * 60 + m
	}

	const getSlotStudentIds = slot => {
		if (slot.slot_type === 'group') {
			if (Array.isArray(slot.group_lesson_attendance) && slot.group_lesson_attendance.length) {
				return slot.group_lesson_attendance
					.filter(attendance => attendance.attended !== false)
					.map(attendance => attendance.student_id)
			}
			return getActiveGroupEnrollments(slot).map(enr => enr.student_id)
		}
		return slot.student_id ? [slot.student_id] : []
	}

	const getSlotTeacherIds = slot => {
		return getSlotTeacherEntries(slot).map(teacher => teacher.id)
	}

	const findConflictingSlots = (weekday, startTime, endTime, roomId, teacherIds = [], studentIds = [], excludeSlotId = null) => {
		if (!scheduleData?.slots) return []
		const checkedStudentIds = new Set(Array.isArray(studentIds) ? studentIds : [studentIds].filter(Boolean))
		const checkedTeacherIds = new Set(Array.isArray(teacherIds) ? teacherIds.map(Number) : [Number(teacherIds)].filter(Boolean))
		const start = timeToMinutes(startTime)
		const end = timeToMinutes(endTime)
		return scheduleData.slots.filter(s => {
			if (excludeSlotId && s.id === excludeSlotId) return false
			if (s.weekday !== weekday) return false
			const sStart = timeToMinutes(s.start_time)
			const sEnd = timeToMinutes(s.end_time)
			if (!(start < sEnd && end > sStart)) return false
			// Only flag conflicts for matching room, teacher, or student
			const hasStudentConflict = getSlotStudentIds(s).some(id => checkedStudentIds.has(id))
			const hasRoomConflict = roomId && s.room_id === roomId
			return hasRoomConflict || getSlotTeacherIds(s).some(id => checkedTeacherIds.has(id)) || hasStudentConflict
		})
	}

	// Mirrors backend ScheduleValidator.IsTeacherAvailable / IsStudentAvailable —
	// HH:MM strings compare lexicographically the same as time, so plain string compare is safe.
	const isWithinAvailabilityWindow = (weekday, startTime, endTime, availability) => {
		for (const w of availability || []) {
			if (w.weekday !== weekday) continue
			if (startTime >= w.start_time && endTime <= w.end_time) return true
		}
		return false
	}

	// Formats the windows defined for a given weekday, e.g. "09:00–12:00, 14:00–17:00", or a fallback if none.
	const describeWindowsForDay = (weekday, availability) => {
		const windows = (availability || []).filter(w => w.weekday === weekday)
		if (windows.length === 0) return 'нет указанных окон на этот день'
		return windows.map(w => `${w.start_time}–${w.end_time}`).join(', ')
	}

	const checkAvailabilityWarnings = (weekday, startTime, endTime, assignment) => {
		const warnings = []
		if (assignment.teacher && !isWithinAvailabilityWindow(weekday, startTime, endTime, assignment.teacher.availability)) {
			warnings.push(
				`Преподаватель «${assignment.teacher.full_name || '—'}» недоступен в это время. ` +
				`Доступность на ${WEEKDAY_NAMES[weekday] || weekday}: ${describeWindowsForDay(weekday, assignment.teacher.availability)}`
			)
		}
		if (assignment.student && !isWithinAvailabilityWindow(weekday, startTime, endTime, assignment.student.availability)) {
			warnings.push(
				`Ученик «${assignment.student.full_name || '—'}» недоступен в это время. ` +
				`Доступность на ${WEEKDAY_NAMES[weekday] || weekday}: ${describeWindowsForDay(weekday, assignment.student.availability)}`
			)
		}
		return warnings
	}

	const describeConflictingSlot = s => {
		const time = `${s.start_time}–${s.end_time}`
		const day = WEEKDAY_NAMES[s.weekday] || s.weekday
		if (s.slot_type === 'group') {
			return `${day} ${time}: ${s.group_lesson?.name || 'Группа'} (${getSlotTeacherLabel(s)}, ${s.room_name || s.room?.name || '—'})`
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
			setConflictDialog({ open: false, conflicts: [], warnings: [], deleteConflicts: true })
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
				const id = Number(filterStudentId)
				if (slot.slot_type === 'group') {
					const hasAttendance = (slot.group_lesson_attendance?.length ?? 0) > 0
					if (hasAttendance) {
						// Attendance records are the source of truth for this specific slot
						if (!slot.group_lesson_attendance.some(a => a.student_id === id)) continue
					} else {
						// No per-slot attendance yet — fall back to base enrollments minus exclusions
						const enrolled = slot.group_lesson?.enrollments?.some(e => e.student_id === id)
						const excluded = slot.exclusions?.some(ex => ex.student_id === id)
						if (!enrolled || excluded) continue
					}
				} else {
					if (slot.student_id !== id) continue
				}
			}
			if (filterTeacherId && !getSlotTeacherIds(slot).includes(Number(filterTeacherId))) continue
			if (filterRoomId && slot.room_id !== Number(filterRoomId)) continue
			if (filterFundingType) {
				if (filterFundingType === 'group') {
					if (slot.slot_type !== 'group') continue
				} else {
					if (slot.slot_type === 'group') continue
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
	const zeroScheduledStudents = scheduleData?.zero_scheduled_students || []
	const isDraft = schedule?.status === 'draft'
	const isApproved = schedule?.status === 'approved'
	const canAddSlot = isDraft || isApproved

	const visibleIssues = issues.filter(i => i.reason_code !== 'NO_STUDENT_LESSONS' && (!hideResolvedDiagnostics || !i.is_resolved))
	const issueConfigCount = visibleIssues.filter(i => !i.is_resolved && !i.message.startsWith('Все возможные')).length
	const issueConflictCount = visibleIssues.filter(i => !i.is_resolved && i.message.startsWith('Все возможные')).length

	return (
		<main className='admin-module admin-schedule-page'>
			<div className='admin-module__container'>
				<section className='admin-module__hero'>
					<div>
						<span className='admin-module__badge'>Расписание</span>
						<h1>Расписание на неделю</h1>
						<p>Генерация, управление и утверждение еженедельного расписания занятий центра.</p>
					</div>
					<div className='admin-module__actions'>
						<Button
							startIcon={<BackIcon />}
							onClick={() => navigate('/admin/schedule')}
							className='admin-module__button admin-module__button--ghost'
						>
							Назад
						</Button>
					</div>
				</section>

				<section className='admin-module__panel'>

				{/* Week navigation */}
				<div className='admin-schedule-week-nav'>
					<button className='admin-schedule-week-nav__btn' onClick={prevWeek}>
						<ChevronLeft />
					</button>
					<span className={`admin-schedule-week-nav__label${isCurrentWeek ? ' admin-schedule-week-nav__label--current' : ''}`}>
						{formatWeekLabel(weekStart)}
						{isCurrentWeek && <span className='admin-schedule-week-nav__badge'>(текущая неделя)</span>}
					</span>
					<button className='admin-schedule-week-nav__btn' onClick={nextWeek}>
						<ChevronRight />
					</button>
				</div>

				{/* Generation settings */}
				<div className='admin-schedule-settings'>
					<span className='admin-schedule-settings__label'>Макс. перерыв у ученика:</span>
					<input
						type='number'
						className='admin-schedule-settings__input'
						value={maxGapMinutes}
						min={10}
						max={120}
						step={5}
						onChange={e => {
							const val = Number(e.target.value)
							setMaxGapMinutes(val)
							if (val >= 10) saveMaxGapMinutes(val)
						}}
					/>
					<span className='admin-schedule-settings__label'>мин.</span>
					{maxGapSaved && <span className='admin-schedule-settings__saved'>✓</span>}

					<span className='admin-schedule-settings__sep' />

					<span className='admin-schedule-settings__label'>Макс. перерыв у преподавателя:</span>
					<input
						type='number'
						className='admin-schedule-settings__input'
						value={teacherGapMinutes}
						min={10}
						max={60}
						step={5}
						onChange={e => {
							const val = Number(e.target.value)
							setTeacherGapMinutes(val)
							if (val >= 10) saveTeacherGapMinutes(val)
						}}
					/>
					<span className='admin-schedule-settings__label'>мин.</span>
					{teacherGapSaved && <span className='admin-schedule-settings__saved'>✓</span>}
				</div>

				{/* Action bar */}
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
					{/* Row 1: status + primary actions */}
					<Box display='flex' alignItems='center' gap={1.5} flexWrap='wrap'>
						{schedule && (
							<Chip
								label={STATUS_LABELS[schedule.status] || schedule.status}
								color={STATUS_COLORS[schedule.status] || 'default'}
								size='medium'
								sx={{ fontWeight: 600 }}
							/>
						)}

						{(isDraft || (!schedule && !loading)) && (
							<Button
								variant='contained'
								startIcon={<GenerateIcon />}
								onClick={generate}
								disabled={generating}
								color={isPastWeek ? 'warning' : 'primary'}
							>
								{generating ? 'Генерация...' : isPastWeek ? '⚠ Сгенерировать' : 'Сгенерировать'}
							</Button>
						)}

						{(isDraft || (!schedule && !loading)) && (
							<Button
								variant='contained'
								color='success'
								startIcon={<ApproveIcon />}
								onClick={approve}
								disabled={!schedule}
							>
								Утвердить
							</Button>
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

						{(canAddSlot || (!schedule && !loading)) && (
							<Button
								variant='outlined'
								startIcon={<AddIcon />}
								onClick={openCreateSlot}
							>
								Добавить занятие
							</Button>
						)}
					</Box>

					{/* Row 2: management + export */}
					{(isDraft || isApproved) && schedule && (
						<Box display='flex' alignItems='center' gap={1} flexWrap='wrap'>
							<Button
								size='small'
								variant='outlined'
								color='inherit'
								onClick={copyManualFromPrevWeek}
								disabled={generating}
							>
								Вставить ручные занятия с прошлой недели
							</Button>

							<Divider orientation='vertical' flexItem sx={{ mx: 0.5 }} />

							<Button
								size='small'
								variant='outlined'
								startIcon={<ClearIcon />}
								onClick={openClearAutoDialog}
								disabled={generating}
								color='error'
							>
								Очистить авто
							</Button>
							<Button
								size='small'
								variant='outlined'
								color='error'
								onClick={openDeleteManualDialog}
								disabled={generating}
							>
								Очистить ручные
							</Button>

							<Divider orientation='vertical' flexItem sx={{ mx: 0.5 }} />

							<Button
								size='small'
								variant='outlined'
								color='secondary'
								onClick={() => openBulkOriginDialog('manual')}
								disabled={generating}
							>
								Всё → Ручное
							</Button>
							<Button
								size='small'
								variant='outlined'
								color='secondary'
								onClick={() => openBulkOriginDialog('auto')}
								disabled={generating}
							>
								Всё → Авто
							</Button>

							<Divider orientation='vertical' flexItem sx={{ mx: 0.5 }} />

							<Button
								size='small'
								variant='outlined'
								color='success'
								startIcon={<ExcelIcon />}
								onClick={exportTeachersToExcel}
							>
								Преподаватели
							</Button>
							<Button
								size='small'
								variant='outlined'
								color='success'
								startIcon={<ExcelIcon />}
								onClick={exportStudentsToExcel}
							>
								Дети
							</Button>
						</Box>
					)}
				</Box>

				{generationProgress && (
					<div className='admin-schedule-progress'>
						<div className='admin-schedule-progress__top'>
							<div>
								<div className='admin-schedule-progress__title'>Идёт генерация...</div>
								<div className='admin-schedule-progress__message'>
									{generationProgress.message || 'Расписание рассчитывается'}
									{generationProgress.strategy ? ` · ${generationProgress.strategy}` : ''}
								</div>
							</div>
							<div className='admin-schedule-progress__percent'>
								{Math.round(generationProgress.percent || 0)}%
							</div>
						</div>
						<div className='admin-schedule-progress__bar'>
							<div
								className='admin-schedule-progress__fill'
								style={{ width: `${Math.max(0, Math.min(100, generationProgress.percent || 0))}%` }}
							/>
						</div>
					</div>
				)}

				{/* Slot filters */}
				{schedule && (
					<Box sx={{ p: 2, mb: 2, border: '1px solid rgba(7,68,98,0.14)', borderRadius: '16px', background: 'rgba(244,223,0,0.05)' }}>
						<Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
							<Box sx={{ flex: '1 1 180px', minWidth: 160 }}>
								<Autocomplete
									size='small'
									fullWidth
									slots={{ popper: WidePopper }}
									options={[...students].sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'))}
									value={students.find(s => s.id === Number(filterStudentId)) || null}
									getOptionLabel={opt => opt.full_name}
									isOptionEqualToValue={(opt, val) => opt.id === val.id}
									onChange={(_, val) => setFilterStudentId(val ? String(val.id) : '')}
									renderInput={params => <TextField {...params} label='Ученик' fullWidth />}
								/>
							</Box>
							<Box sx={{ flex: '1 1 180px', minWidth: 160 }}>
								<Autocomplete
									size='small'
									fullWidth
									slots={{ popper: WidePopper }}
									options={[...teachers].sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'))}
									value={teachers.find(t => t.id === Number(filterTeacherId)) || null}
									getOptionLabel={opt => opt.full_name}
									isOptionEqualToValue={(opt, val) => opt.id === val.id}
									onChange={(_, val) => setFilterTeacherId(val ? String(val.id) : '')}
									renderInput={params => <TextField {...params} label='Преподаватель' fullWidth />}
								/>
							</Box>
							<Box sx={{ flex: '0 1 160px', minWidth: 140 }}>
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
							</Box>
							<Box sx={{ flex: '0 1 210px', minWidth: 190 }}>
								<FormControl fullWidth size='small'>
									<InputLabel>Вид занятия</InputLabel>
									<Select
										value={filterFundingType}
										label='Вид занятия'
										onChange={e => setFilterFundingType(e.target.value)}
									>
										<MenuItem value=''>Все</MenuItem>
										<MenuItem value='paid'>Платники (индив.)</MenuItem>
										<MenuItem value='budget'>Бюджетники (индив.)</MenuItem>
										<MenuItem value='group'>Групповые занятия</MenuItem>
									</Select>
								</FormControl>
							</Box>
							<Box sx={{ flexShrink: 0 }}>
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
							</Box>
						</Box>

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
					</Box>
				)}

				{/* Stats */}
				{stats && (
					<div className='admin-schedule-stats'>
						{[
							{ value: stats.total_requested, label: 'Запрошено', sub: `${stats.ind_requested} инд. + ${stats.grp_requested} групп.` },
							{ value: stats.scheduled, label: 'Поставлено', sub: `${stats.ind_scheduled} инд. + ${stats.grp_scheduled} групп.` },
							{
								value: stats.unplaced,
								label: 'Не поставлено',
								sub: stats.unplaced > 0
									? [issueConfigCount > 0 && `${issueConfigCount} конфиг.`, issueConflictCount > 0 && `${issueConflictCount} конфл.`].filter(Boolean).join(' + ') || `${stats.unplaced} всего`
									: '—',
							},
						].map(({ value, label, sub }) => (
							<div className='admin-schedule-stat' key={label}>
								<div className='admin-schedule-stat__value'>{value}</div>
								<div className='admin-schedule-stat__label'>{label}</div>
								<div className='admin-schedule-stat__sub'>{sub}</div>
							</div>
						))}
					</div>
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
							<Box key={day} mb={3} sx={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
								<div className='admin-schedule-day__header'>
									<span className='admin-schedule-day__name'>{WEEKDAY_NAMES[day]}</span>
									<span className='admin-schedule-day__date'>
										{getWeekdayDate(weekStart, day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
									</span>
									<span className='admin-schedule-day__count'>
										{daySlots.length} {daySlots.length === 1 ? 'занятие' : daySlots.length < 5 ? 'занятия' : 'занятий'}
									</span>
								</div>
								<TableContainer className='no-radius'>
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
										{(slot.teachers || []).length
											? slot.teachers.map(link => link.teacher?.full_name || link.teacher_id).join(', ')
											: (slot.teacher?.full_name || slot.teacher_id)}
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
																<IconButton size='small' color='info' onClick={() => openAttendanceDialog(slot)}>
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
															onClick={() => confirmDeleteSlot(slot)}
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
				{!loading && visibleIssues.length > 0 && (() => {
					const filtered = visibleIssues.filter(issue => {
						if (issue.reason_code === 'NO_STUDENT_LESSONS') return false
						if (filterIssueStudentId && issue.student_id !== Number(filterIssueStudentId)) return false
						if (filterIssueTeacherId && issue.teacher_id !== Number(filterIssueTeacherId)) return false
						if (filterIssueFundingType) {
							const student = students.find(s => s.id === issue.student_id) || issue.student
							if (student?.funding_type !== filterIssueFundingType) return false
						}
						return true
					})

					const isConflict = issue => issue.message.startsWith('Все возможные')
					const configErrors = filtered.filter(i => !isConflict(i))
					const conflicts = filtered.filter(i => isConflict(i))

					const activeSlots = (scheduleData?.slots || []).filter(slot => slot.status !== 'cancelled')
					const groupIssues = list => {
						const groups = new Map()
						list.forEach(issue => {
							const isGroup = Boolean(issue.group_lesson_id)
							const entityID = isGroup ? issue.group_lesson_id : issue.assignment_id
							const fallbackKey = `${issue.student_id || ''}-${issue.teacher_id || ''}-${issue.subject_id || ''}`
							const key = `${isGroup ? 'group' : 'assignment'}-${entityID || fallbackKey}`
							if (!groups.has(key)) {
								const studentName = isGroup
									? `Группа: ${issue.group_lesson?.name || issue.group_lesson_id}`
									: (issue.student?.full_name || `Ученик #${issue.student_id}`)
								const subjectName = issue.subject?.name || issue.assignment?.subject?.name || 'Без предмета'
								const expected = isGroup ? issue.group_lesson?.visits_per_week : issue.assignment?.visits_per_week
								const scheduled = activeSlots.filter(slot => isGroup
									? slot.group_lesson_id === issue.group_lesson_id
									: slot.assignment_id === issue.assignment_id,
								).length
								groups.set(key, { key, studentName, subjectName, expected: expected || 0, scheduled, issues: [] })
							}
							groups.get(key).issues.push(issue)
						})
						return [...groups.values()]
							.map(group => ({
								...group,
								issues: [...group.issues].sort((a, b) => Number(a.is_resolved) - Number(b.is_resolved)),
							}))
							.sort((a, b) => {
								const aResolved = a.issues.every(issue => issue.is_resolved)
								const bResolved = b.issues.every(issue => issue.is_resolved)
								if (aResolved !== bResolved) return Number(aResolved) - Number(bResolved)
								return a.studentName.localeCompare(b.studentName, 'ru') || a.subjectName.localeCompare(b.subjectName, 'ru')
							})
					}

					const issueHead = (
						<TableHead>
							<TableRow>
								<TableCell sx={{ width: '24%' }}>Преподаватель</TableCell>
								<TableCell align='center' sx={{ width: '16%' }}>Статус</TableCell>
								<TableCell sx={{ width: '60%' }}>Причина</TableCell>
							</TableRow>
						</TableHead>
					)

					const renderRows = list => list.map(issue => (
						<TableRow key={issue.id} sx={issue.is_resolved ? { opacity: 0.55, bgcolor: '#f1f8f3' } : undefined}>
							<TableCell sx={issue.is_resolved ? { textDecoration: 'line-through' } : undefined}>{issue.teacher?.full_name || issue.teacher_id || '—'}</TableCell>
							<TableCell align='center'>{issue.is_resolved ? <Tooltip title='Исправлено вручную'><ConductedIcon color='success' fontSize='small' /></Tooltip> : 'Требует внимания'}</TableCell>
							<TableCell sx={issue.is_resolved ? { textDecoration: 'line-through' } : undefined}>{issue.message}</TableCell>
						</TableRow>
					))

					const renderIssueGroups = list => groupIssues(list).map(group => {
						const resolved = group.issues.every(issue => issue.is_resolved)
						const progressColor = resolved
							? { backgroundColor: '#76a878', color: '#fff' }
							: group.scheduled === 0
								? { backgroundColor: '#ef6c00', color: '#fff' }
								: { backgroundColor: '#f4d35e', color: '#513b00' }
						return (
							<Box className='schedule-issue-group' key={group.key} sx={{ mb: 1.5, borderColor: resolved ? '#b9dfc2' : '#e2d7c4', opacity: resolved ? 0.65 : 1 }}>
								<Box sx={{ px: 2, py: 1.25, bgcolor: resolved ? '#eff8f1' : '#faf6ee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
									<Box>
										<Typography fontWeight={700} sx={resolved ? { textDecoration: 'line-through' } : undefined}>{group.studentName}</Typography>
										<Typography variant='body2' color='text.secondary' sx={resolved ? { textDecoration: 'line-through' } : undefined}>{group.subjectName}</Typography>
									</Box>
									<Chip size='small' label={`${group.scheduled}/${group.expected} занятий`} sx={{ fontWeight: 700, ...progressColor }} />
								</Box>
								<TableContainer className='schedule-issue-group__table'><Table size='small' sx={{ width: '100%', tableLayout: 'fixed' }}>{issueHead}<TableBody>{renderRows(group.issues)}</TableBody></Table></TableContainer>
							</Box>
						)
					})

					return (
						<Accordion
							sx={{
								mt: 2,
								borderRadius: '14px !important',
								boxShadow: 'none',
								overflow: 'hidden',
								border: '1px solid #e0e0e0',
								'&:before': { display: 'none' },
							}}
						>
							<AccordionSummary
								expandIcon={<ExpandIcon sx={{ color: 'white' }} />}
								sx={{
									bgcolor: '#c62828',
									color: 'white',
									minHeight: '48px !important',
									'& .MuiAccordionSummary-content': { my: '12px' },
								}}
							>
								<Box display='flex' alignItems='center' gap={1.5}>
									<span style={{ fontWeight: 800, fontSize: 15 }}>⚠ Проблемы при генерации</span>
									{issueConfigCount > 0 && (
										<span style={{ fontSize: 13, opacity: 0.85 }}>{issueConfigCount} конфигурации</span>
									)}
									{issueConflictCount > 0 && (
										<span style={{ fontSize: 13, opacity: 0.85 }}>{issueConflictCount} конфликтов</span>
									)}
									<Button
										size='small'
										variant='outlined'
										onClick={refreshDiagnostics}
										disabled={refreshingDiagnostics}
										sx={{ ml: 1, color: 'white', borderColor: 'rgba(255,255,255,.7)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,.12)' } }}
									>
										{refreshingDiagnostics ? 'Проверяем…' : 'Обновить'}
									</Button>
								</Box>
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
										<Box className='schedule-diagnostic-heading schedule-diagnostic-heading--configuration'>
											Ошибки конфигурации — занятие невозможно поставить из-за неполных настроек ({configErrors.length})
										</Box>
										{renderIssueGroups(configErrors)}
									</Box>
								)}

								{/* Category 2: schedule conflicts */}
								{conflicts.length > 0 && (
									<Box sx={{ pt: configErrors.length > 0 ? 2 : 0 }}>
										<Box className='schedule-diagnostic-heading schedule-diagnostic-heading--conflict'>
											Конфликты расписания — все слоты заняты другими занятиями ({conflicts.length})
										</Box>
										{renderIssueGroups(conflicts)}
									</Box>
								)}
							</AccordionDetails>
						</Accordion>
					)
				})()}

				{!loading && zeroScheduledStudents.length > 0 && (() => {
					const displayedZeroScheduledStudents = hideResolvedDiagnostics
						? zeroScheduledStudents.filter(student => !student.is_resolved)
						: zeroScheduledStudents
					if (displayedZeroScheduledStudents.length === 0) return null
					return (
					<Accordion
						className='schedule-zero-diagnostics'
						defaultExpanded
						sx={{
							mt: 2,
							borderRadius: '14px !important',
							boxShadow: 'none',
							overflow: 'hidden',
							border: '1px solid #e0d1b4',
							'&:before': { display: 'none' },
						}}
					>
						<AccordionSummary
							expandIcon={<ExpandIcon sx={{ color: 'white' }} />}
							sx={{
								bgcolor: '#d97706',
								color: 'white',
								minHeight: '48px !important',
								'& .MuiAccordionSummary-content': { my: '12px' },
							}}
						>
							<Box display='flex' alignItems='center' gap={1.5}>
								<span style={{ fontWeight: 800, fontSize: 15 }}>Ученики без проставленных занятий ({zeroScheduledStudents.filter(student => !student.is_resolved).length} требуют внимания)</span>
								<Button
									size='small'
									variant='outlined'
									onClick={refreshDiagnostics}
									disabled={refreshingDiagnostics}
									sx={{ ml: 1, color: 'white', borderColor: 'rgba(255,255,255,.7)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,.12)' } }}
								>
									{refreshingDiagnostics ? 'Проверяем…' : 'Обновить'}
								</Button>
							</Box>
						</AccordionSummary>
						<AccordionDetails sx={{ p: 0 }}>
							<Alert severity='warning' sx={{ mb: 1.5, borderRadius: 0 }}>
								Показываются результаты последней генерации и новые активные назначения без занятий. «Обновить» скрывает исправленные строки и заново проверяет текущие назначения.
							</Alert>
							<TableContainer>
							<Table size='small'>
								<TableHead>
									<TableRow>
									<TableCell>Ученик</TableCell>
									<TableCell align='center'>Статус</TableCell>
										<TableCell align='center'>Активных назначений</TableCell>
										<TableCell align='center'>Запрошено занятий в неделю</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{[...displayedZeroScheduledStudents].sort((a, b) => Number(a.is_resolved) - Number(b.is_resolved) || (a.student_name || '').localeCompare(b.student_name || '', 'ru')).map(student => (
									<TableRow key={student.student_id} sx={student.is_resolved ? { opacity: 0.55, bgcolor: '#f1f8f3' } : undefined}>
										<TableCell sx={student.is_resolved ? { textDecoration: 'line-through' } : undefined}>{student.student_name || `#${student.student_id}`}</TableCell>
										<TableCell align='center'>{student.is_resolved ? <Tooltip title='Исправлено вручную'><ConductedIcon color='success' fontSize='small' /></Tooltip> : 'Требует внимания'}</TableCell>
											<TableCell align='center'>{student.assignments}</TableCell>
											<TableCell align='center'>{student.requested_visits}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
							</TableContainer>
						</AccordionDetails>
					</Accordion>
					)
				})()}

			{/* Create Slot Dialog */}
			<Dialog
				open={createDialog}
				onClose={() => setCreateDialog(false)}
				maxWidth='sm'
				fullWidth
				PaperProps={{ className: 'admin-module-dialog' }}
			>
				<DialogTitle className='admin-module-dialog__title'>Добавить занятие вручную</DialogTitle>
				<DialogContent className='admin-module-dialog__content'>
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
								onChange={(event, value) => {
									const teacherRooms = value?.teacher?.rooms || []
									setSlotForm({
										...slotForm,
										assignment_id: value?.id || '',
										room_id: teacherRooms.length === 1 ? (teacherRooms[0].room_id || '') : slotForm.room_id,
									})
								}}
								renderInput={params => (
									<TextField {...params} label='Назначение' required />
								)}
							/>
						)}
						{slotForm.slot_type === 'group' && (
							<>
								<Autocomplete
									options={groupLessons}
									value={groupLessons.find(g => g.id === Number(slotForm.group_lesson_id)) || null}
									getOptionLabel={g =>
										g ? `${g.name} (${g.subject?.name || 'Без предмета'}, ${g.enrollments?.length || 0} уч.)` : ''
									}
								onChange={(event, value) => {
									const dur = value?.duration_min
									const [h, m] = slotForm.start_time.split(':').map(Number)
									const endMin = h * 60 + m + (dur || 50)
									const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
									setSlotForm({
										...slotForm,
										group_lesson_id: value?.id || '',
										subject_id: value?.subject_id || '',
										teacher_id: (value?.teachers || [])[0]?.teacher_id || value?.default_teacher_id || '',
										teacher_ids: (value?.teachers || []).map(link => link.teacher_id),
										teacher_hours_mode: value?.teacher_hours_mode || 'full',
										room_name: value?.room_name || '',
										ignore_student_windows: value?.ignore_student_windows || false,
										end_time: value ? endTime : slotForm.end_time,
									})
								}}
									renderInput={params => (
										<TextField {...params} label='Группа' required />
									)}
								/>
								<Autocomplete
									multiple
									options={teachers.filter(t => t.is_active)}
									getOptionLabel={teacher => teacher.full_name || `#${teacher.id}`}
									isOptionEqualToValue={(left, right) => left.id === right.id}
									value={teachers.filter(t => slotForm.teacher_ids.includes(t.id))}
									onChange={(_, value) => setSlotForm({ ...slotForm, teacher_ids: value.map(teacher => teacher.id) })}
									renderInput={params => <TextField {...params} label='Преподаватели' required />}
								/>
								<FormControl fullWidth>
									<InputLabel>Учёт часов преподавателей</InputLabel>
									<Select value={slotForm.teacher_hours_mode} label='Учёт часов преподавателей' onChange={e => setSlotForm({ ...slotForm, teacher_hours_mode: e.target.value })}>
										<MenuItem value='full'>Полный</MenuItem>
										<MenuItem value='split'>Раздельный</MenuItem>
									</Select>
								</FormControl>
								<FormControlLabel
									control={
										<Checkbox
											checked={slotForm.ignore_student_windows}
											onChange={e => setSlotForm({ ...slotForm, ignore_student_windows: e.target.checked })}
										/>
									}
									label='Игнорировать окна учеников при расстановке'
								/>
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
				<DialogActions className='admin-module-dialog__actions'>
					<Button onClick={() => setCreateDialog(false)}>Отмена</Button>
					<Button onClick={() => createSlot()} variant='contained'>
						Добавить
					</Button>
				</DialogActions>
			</Dialog>

			{/* Missing reporting tariff confirmation. It never discards the manual form. */}
			<Dialog
				open={reportTariffConfirm.open}
				onClose={closeReportTariffConfirm}
				maxWidth='xs'
				fullWidth
				PaperProps={{ className: 'admin-module-dialog' }}
			>
				<DialogTitle className='admin-module-dialog__title'>Нет тарифа для отчётности</DialogTitle>
				<DialogContent className='admin-module-dialog__content'>
					<Alert severity='warning' sx={{ mb: 2 }}>
						{reportTariffConfirm.preview?.slot_type === 'group' ? 'Групповое' : 'Индивидуальное'} занятие не покрыто активным правилом тарификации.
					</Alert>
					<Typography>
						{reportTariffConfirm.subjectName} · {reportTariffConfirm.preview?.duration_minutes || 0} мин
					</Typography>
					<Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
						Если {reportTariffConfirm.action === 'save' ? 'сохранить' : 'создать'} занятие сейчас, в отчётности тариф и сумма для него будут равны 0 руб.
					</Typography>
				</DialogContent>
				<DialogActions className='admin-module-dialog__actions'>
					<Button onClick={closeReportTariffConfirm}>Вернуться к форме</Button>
					<Button variant='contained' color='warning' onClick={acknowledgeMissingReportTariff}>{reportTariffConfirm.action === 'save' ? 'Сохранить всё равно' : 'Создать всё равно'}</Button>
				</DialogActions>
			</Dialog>

			{/* Group duration confirmation */}
			<Dialog
				open={groupDurationConfirm.open}
				onClose={() => setGroupDurationConfirm(prev => ({ ...prev, open: false }))}
				maxWidth='xs'
				fullWidth
				PaperProps={{ className: 'admin-module-dialog' }}
			>
				<DialogTitle className='admin-module-dialog__title'>Подтверждение создания занятия</DialogTitle>
				<DialogContent className='admin-module-dialog__content'>
					<Typography>
						Вы указали занятие с {groupDurationConfirm.start} до {groupDurationConfirm.end} ({groupDurationConfirm.actual} мин),
						хотя групповое занятие рассчитано на {groupDurationConfirm.expected} мин. Вы уверены?
					</Typography>
				</DialogContent>
				<DialogActions className='admin-module-dialog__actions'>
					<Button onClick={() => setGroupDurationConfirm(prev => ({ ...prev, open: false }))}>Отмена</Button>
					<Button variant='contained' onClick={() => {
						setGroupDurationConfirm(prev => ({ ...prev, open: false }))
						createSlot(true)
					}}>Да, создать</Button>
				</DialogActions>
			</Dialog>

			{/* Edit Slot Dialog */}
			<Dialog
				open={editDialog.open}
				onClose={() => setEditDialog({ open: false, slot: null, groupAttendance: [], groupAttendanceLoading: false })}
				maxWidth='sm'
				fullWidth
				PaperProps={{ className: 'admin-module-dialog' }}
			>
				<DialogTitle className='admin-module-dialog__title'>
					{editDialog.slot?.slot_type === 'group'
						? `Групповое занятие: ${editDialog.slot?.group_lesson?.name || ''}`
						: 'Редактировать слот'}
				</DialogTitle>
				<DialogContent className='admin-module-dialog__content'>
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
						{editDialog.slot?.slot_type === 'group' ? (
							<TextField
								label='Кабинет / место проведения'
								value={editForm.room_name}
								onChange={e => setEditForm(prev => ({ ...prev, room_name: e.target.value }))}
								fullWidth
								required
							/>
						) : (
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
						)}
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
						{editDialog.slot?.slot_type === 'group' && (
							<>
								<Autocomplete
									multiple
									options={teachers.filter(t => t.is_active)}
									getOptionLabel={teacher => teacher.full_name || `#${teacher.id}`}
									isOptionEqualToValue={(left, right) => left.id === right.id}
									value={teachers.filter(t => editForm.teacher_ids.includes(t.id))}
									onChange={(_, value) => setEditForm(prev => ({ ...prev, teacher_ids: value.map(teacher => teacher.id) }))}
									renderInput={params => <TextField {...params} label='Преподаватели' required />}
								/>
								<FormControl fullWidth>
									<InputLabel>Учёт часов преподавателей</InputLabel>
									<Select value={editForm.teacher_hours_mode} label='Учёт часов преподавателей' onChange={e => setEditForm(prev => ({ ...prev, teacher_hours_mode: e.target.value }))}>
										<MenuItem value='full'>Полный</MenuItem>
										<MenuItem value='split'>Раздельный</MenuItem>
									</Select>
								</FormControl>
							</>
						)}

						{/* Group slot: attendance-based session management */}
						{editDialog.slot?.slot_type === 'group' && (
							<>
								<Divider />
								<FormControlLabel
									control={
										<Checkbox
											checked={editForm.ignore_student_windows}
											onChange={e => setEditForm(prev => ({ ...prev, ignore_student_windows: e.target.checked }))}
										/>
									}
									label='Игнорировать окна учеников при расстановке'
								/>
								<Divider />
								<Typography variant='subtitle2'>Состав на это занятие</Typography>
								{editDialog.groupAttendanceLoading ? (
									<Box display='flex' justifyContent='center' p={1}><CircularProgress size={20} /></Box>
								) : (
									<>
										{editDialog.groupAttendance.length === 0 && (
											<Typography variant='body2' color='text.secondary'>Нет учеников в этом занятии</Typography>
										)}
										<List dense disablePadding>
											{editDialog.groupAttendance.map(rec => (
												<ListItem key={rec.id} disableGutters>
													<ListItemText primary={rec.student?.full_name || `#${rec.student_id}`} />
													<ListItemSecondaryAction>
														<Tooltip title='Убрать из занятия'>
															<IconButton size='small' color='error' onClick={() => handleRemoveFromEditSession(rec.student_id)}>
																<DeleteIcon fontSize='small' />
															</IconButton>
														</Tooltip>
													</ListItemSecondaryAction>
												</ListItem>
											))}
										</List>
										{(() => {
											const inSession = new Set(editDialog.groupAttendance.map(r => r.student_id))
											const notInSession = (editDialog.slot?.group_lesson?.enrollments || []).filter(enr => !inSession.has(enr.student_id))
											return (
												<Box display='flex' flexDirection='column' gap={1}>
													<Box display='flex' gap={1} alignItems='center'>
														<Autocomplete
															fullWidth
															size='small'
															options={students.filter(s => !inSession.has(s.id)).sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'))}
															value={students.find(s => s.id === Number(addGroupStudentId)) || null}
															getOptionLabel={s => s?.full_name || ''}
															onChange={(_, value) => setAddGroupStudentId(value?.id || '')}
															renderInput={params => <TextField {...params} label='Добавить ученика в занятие' />}
														/>
														<Button variant='outlined' onClick={() => handleAddToEditSession()} disabled={!addGroupStudentId}>
															Добавить
														</Button>
													</Box>
													{notInSession.length > 0 && (
														<Box>
															<Typography variant='caption' color='text.secondary'>Из состава группы:</Typography>
															<Box display='flex' flexWrap='wrap' gap={0.5} mt={0.5}>
																{notInSession.map(enr => (
																	<Chip
																		key={enr.student_id}
																		label={enr.student?.full_name || `#${enr.student_id}`}
																		size='small'
																		onClick={() => handleAddToEditSession(enr.student_id)}
																		icon={<IncludeIcon />}
																	/>
																))}
															</Box>
														</Box>
													)}
												</Box>
											)
										})()}
									</>
								)}
							</>
						)}
					</Box>
				</DialogContent>
				<DialogActions className='admin-module-dialog__actions'>
					<Button onClick={() => setEditDialog({ open: false, slot: null, groupAttendance: [], groupAttendanceLoading: false })}>
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
				PaperProps={{ className: 'admin-module-dialog' }}
			>
				<DialogTitle className='admin-module-dialog__title' sx={{ color: 'warning.main' }}>⚠ Прошедшая неделя</DialogTitle>
				<DialogContent className='admin-module-dialog__content'>
					<Typography>{pastWeekConfirm.message}</Typography>
				</DialogContent>
				<DialogActions className='admin-module-dialog__actions'>
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
				onClose={() => setAttendanceDialog({ open: false, slot: null, attendance: [], loading: false })}
				maxWidth='xs'
				fullWidth
				PaperProps={{ className: 'admin-module-dialog' }}
			>
				<DialogTitle className='admin-module-dialog__title'>
					Посещаемость
					<Typography variant='caption' display='block' color='text.secondary'>
						{attendanceDialog.slot?.group_lesson?.name} · {WEEKDAY_NAMES[attendanceDialog.slot?.weekday]} {attendanceDialog.slot?.start_time}–{attendanceDialog.slot?.end_time}
					</Typography>
				</DialogTitle>
				<DialogContent className='admin-module-dialog__content'>
					{attendanceDialog.loading ? (
						<Box display='flex' justifyContent='center' p={2}><CircularProgress size={24} /></Box>
					) : attendanceDialog.attendance.length === 0 ? (
						<Typography variant='body2' color='text.secondary'>Нет учеников на этом занятии</Typography>
					) : (
						<List dense disablePadding>
							{attendanceDialog.attendance.map(rec => {
								const isAbsent = rec.attended === false
								const isPresent = rec.attended === true
								return (
									<ListItem key={rec.id} disableGutters>
										<ListItemText
											primary={rec.student?.full_name || `Ученик #${rec.student_id}`}
											secondary={isAbsent ? 'Отсутствовал' : isPresent ? 'Присутствовал' : 'Не отмечено'}
											primaryTypographyProps={{ sx: isAbsent ? { color: 'text.secondary', textDecoration: 'line-through' } : {} }}
											secondaryTypographyProps={{ color: isAbsent ? 'error' : isPresent ? 'success.main' : 'text.disabled' }}
										/>
										<ListItemSecondaryAction>
											<Tooltip title={isAbsent ? 'Отметить присутствие' : 'Отметить отсутствие'}>
												<IconButton size='small' color={isAbsent ? 'success' : 'error'} onClick={() => handleToggleAttendance(rec)}>
													{isAbsent ? <IncludeIcon fontSize='small' /> : <ExcludeIcon fontSize='small' />}
												</IconButton>
											</Tooltip>
											<Tooltip title='Убрать из занятия'>
												<IconButton size='small' onClick={() => handleRemoveFromSession(rec.student_id)}>
													<DeleteIcon fontSize='small' />
												</IconButton>
											</Tooltip>
										</ListItemSecondaryAction>
									</ListItem>
								)
							})}
						</List>
					)}
					{/* Add student to this session from enrollment list */}
					{(() => {
						const inSession = new Set(attendanceDialog.attendance.map(r => r.student_id))
						const notInSession = (attendanceDialog.slot?.group_lesson?.enrollments || [])
							.filter(enr => !inSession.has(enr.student_id))
						if (!notInSession.length) return null
						return (
							<Box mt={2}>
								<Typography variant='caption' color='text.secondary'>Добавить из списка группы:</Typography>
								<Box display='flex' flexWrap='wrap' gap={0.5} mt={0.5}>
									{notInSession.map(enr => (
										<Chip
											key={enr.student_id}
											label={enr.student?.full_name || `#${enr.student_id}`}
											size='small'
											onClick={() => handleAddToSession(enr.student_id)}
											icon={<IncludeIcon />}
										/>
									))}
								</Box>
							</Box>
						)
					})()}
				</DialogContent>
				<DialogActions className='admin-module-dialog__actions'>
					<Button onClick={() => setAttendanceDialog({ open: false, slot: null, attendance: [], loading: false })}>Закрыть</Button>
				</DialogActions>
			</Dialog>

			{/* Delete Slot Confirmation Dialog */}
			<Dialog open={deleteSlotDialog.open} onClose={() => setDeleteSlotDialog({ open: false, slotId: null, slotLabel: '' })} maxWidth='xs' fullWidth PaperProps={{ className: 'admin-module-dialog' }}>
				<DialogTitle className='admin-module-dialog__title'>Удалить занятие?</DialogTitle>
				<DialogContent className='admin-module-dialog__content'>
					<Typography>{deleteSlotDialog.slotLabel}</Typography>
					<Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
						Занятие будет удалено вместе со всеми записями о посещаемости.
					</Typography>
				</DialogContent>
				<DialogActions className='admin-module-dialog__actions'>
					<Button onClick={() => setDeleteSlotDialog({ open: false, slotId: null, slotLabel: '' })}>Отмена</Button>
					<Button variant='contained' color='error' onClick={deleteSlot}>Удалить</Button>
				</DialogActions>
			</Dialog>

			{/* Conflict Warning Dialog */}
			<Dialog
				open={conflictDialog.open}
				onClose={() => setConflictDialog({ open: false, conflicts: [], warnings: [], deleteConflicts: true })}
				maxWidth='sm'
				fullWidth
				PaperProps={{ className: 'admin-module-dialog' }}
			>
				<DialogTitle className='admin-module-dialog__title'>Конфликт занятий</DialogTitle>
				<DialogContent className='admin-module-dialog__content'>
					{conflictDialog.conflicts.length > 0 && (
						<>
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
						</>
					)}
					{(conflictDialog.warnings || []).length > 0 && (
						<>
							<Typography variant='body2' color='warning.main' gutterBottom sx={{ mt: conflictDialog.conflicts.length > 0 ? 2 : 0 }}>
								Нарушение окна доступности:
							</Typography>
							<List dense>
								{conflictDialog.warnings.map((w, i) => (
									<ListItem key={i} disableGutters>
										<ListItemText primary={w} />
									</ListItem>
								))}
							</List>
						</>
					)}
				</DialogContent>
				<DialogActions className='admin-module-dialog__actions'>
					<Button
						onClick={() =>
							setConflictDialog({ open: false, conflicts: [], warnings: [], deleteConflicts: true })
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
				PaperProps={{ className: 'admin-module-dialog' }}
			>
				<DialogTitle className='admin-module-dialog__title'>Нельзя утвердить: есть конфликты</DialogTitle>
				<DialogContent className='admin-module-dialog__content'>
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
				<DialogActions className='admin-module-dialog__actions'>
					<Button onClick={() => setApproveConflictDialog({ open: false, pairs: [] })}>
						Закрыть
					</Button>
				</DialogActions>
			</Dialog>

			{/* Clear auto slots confirmation dialog */}
			<Dialog
				open={clearAutoDialog.open}
				onClose={closeClearAutoDialog}
				maxWidth='xs'
				fullWidth
				PaperProps={{ className: 'admin-module-dialog' }}
			>
				<DialogTitle className='admin-module-dialog__title'>Очистить авто-слоты?</DialogTitle>
				<DialogContent className='admin-module-dialog__content'>
					<Typography variant='body2'>
						Все авто-слоты этой недели будут удалены. Ручные слоты сохранятся. Перегенерации не будет.
					</Typography>
				</DialogContent>
				<DialogActions className='admin-module-dialog__actions'>
					<Button onClick={closeClearAutoDialog}>Отмена</Button>
					<Button
						variant='contained'
						color='error'
						onClick={() => { closeClearAutoDialog(); doClearAuto() }}
						disabled={clearAutoDialog.countdown > 0}
					>
						{clearAutoDialog.countdown > 0
							? `Очистить (${clearAutoDialog.countdown})`
							: 'Очистить'}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Clear manual slots confirmation dialog */}
			<Dialog
				open={deleteManualDialog.open}
				onClose={closeDeleteManualDialog}
				maxWidth='xs'
				fullWidth
				PaperProps={{ className: 'admin-module-dialog' }}
			>
				<DialogTitle className='admin-module-dialog__title'>Очистить ручные слоты?</DialogTitle>
				<DialogContent className='admin-module-dialog__content'>
					<Typography variant='body2'>
						Все ручные слоты будут удалены. Авто-слоты останутся без изменений.
					</Typography>
				</DialogContent>
				<DialogActions className='admin-module-dialog__actions'>
					<Button onClick={closeDeleteManualDialog}>Отмена</Button>
					<Button
						variant='contained'
						color='error'
						onClick={doDeleteManualSlots}
						disabled={deleteManualDialog.countdown > 0}
					>
						{deleteManualDialog.countdown > 0
							? `Очистить (${deleteManualDialog.countdown})`
							: 'Очистить'}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Bulk origin change confirmation dialog */}
			<Dialog
				open={bulkOriginDialog.open}
				onClose={closeBulkOriginDialog}
				maxWidth='xs'
				fullWidth
				PaperProps={{ className: 'admin-module-dialog' }}
			>
				<DialogTitle className='admin-module-dialog__title'>
					{bulkOriginDialog.origin === 'manual' ? 'Перевести всё в ручной режим?' : 'Перевести всё в авто режим?'}
				</DialogTitle>
				<DialogContent className='admin-module-dialog__content'>
					<Typography variant='body2'>
						{bulkOriginDialog.origin === 'manual'
							? 'Все занятия расписания будут помечены как ручные. Они не будут удалены при следующей генерации.'
							: 'Все занятия расписания будут помечены как авто. При следующей генерации авто-занятия будут заменены.'}
					</Typography>
				</DialogContent>
				<DialogActions className='admin-module-dialog__actions'>
					<Button onClick={closeBulkOriginDialog}>Отмена</Button>
					<Button
						variant='contained'
						color='secondary'
						onClick={confirmBulkOrigin}
						disabled={bulkOriginDialog.countdown > 0}
					>
						{bulkOriginDialog.countdown > 0
							? `Вы уверены? (${bulkOriginDialog.countdown})`
							: 'Подтвердить'}
					</Button>
				</DialogActions>
			</Dialog>
			</section>{/* end panel */}
			</div>{/* end container */}
		</main>
	)
}

export default AdminSchedule
