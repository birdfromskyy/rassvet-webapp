import api from './api'

const scheduleService = {
	// ========== SUBJECTS ==========
	getSubjects: async () => {
		const r = await api.get('/admin/subjects')
		return r.data.subjects || []
	},
	createSubject: async data => {
		const r = await api.post('/admin/subjects', data)
		return r.data.subject
	},
	updateSubject: async (id, data) => {
		const r = await api.put(`/admin/subjects/${id}`, data)
		return r.data.subject
	},
	deleteSubject: async id => {
		await api.delete(`/admin/subjects/${id}`)
	},

	// ========== TEACHERS ==========
	getTeachers: async () => {
		const r = await api.get('/admin/teachers')
		return r.data.teachers || []
	},
	createTeacher: async data => {
		const r = await api.post('/admin/teachers', data)
		return r.data.teacher
	},
	updateTeacher: async (id, data) => {
		const r = await api.put(`/admin/teachers/${id}`, data)
		return r.data.teacher
	},
	deleteTeacher: async id => {
		await api.delete(`/admin/teachers/${id}`)
	},
	getTeacherSubjects: async id => {
		const r = await api.get(`/admin/teachers/${id}/subjects`)
		return r.data.teacher_subjects || []
	},
	updateTeacherSubjects: async (id, subjectIds) => {
		const r = await api.put(`/admin/teachers/${id}/subjects`, {
			subject_ids: subjectIds,
		})
		return r.data.teacher_subjects || []
	},
	getTeacherAvailability: async id => {
		const r = await api.get(`/admin/teachers/${id}/availability`)
		return r.data.availability || []
	},
	createTeacherAvailability: async (id, data) => {
		const r = await api.post(`/admin/teachers/${id}/availability`, data)
		return r.data.availability
	},
	updateTeacherAvailability: async (id, availId, data) => {
		const r = await api.put(
			`/admin/teachers/${id}/availability/${availId}`,
			data,
		)
		return r.data.availability
	},
	deleteTeacherAvailability: async (id, availId) => {
		await api.delete(`/admin/teachers/${id}/availability/${availId}`)
	},

	// ========== ROOMS ==========
	getRooms: async () => {
		const r = await api.get('/admin/rooms')
		return r.data.rooms || []
	},
	createRoom: async data => {
		const r = await api.post('/admin/rooms', data)
		return r.data.room
	},
	updateRoom: async (id, data) => {
		const r = await api.put(`/admin/rooms/${id}`, data)
		return r.data.room
	},
	deleteRoom: async id => {
		await api.delete(`/admin/rooms/${id}`)
	},
	getRoomSubjects: async id => {
		const r = await api.get(`/admin/rooms/${id}/subjects`)
		return r.data.room_subjects || []
	},
	updateRoomSubjects: async (id, subjectIds) => {
		const r = await api.put(`/admin/rooms/${id}/subjects`, {
			subject_ids: subjectIds,
		})
		return r.data
	},

	// ========== STUDENTS ==========
	getStudents: async () => {
		const r = await api.get('/admin/students')
		return r.data.students || []
	},
	createStudent: async data => {
		const r = await api.post('/admin/students', data)
		return r.data.student
	},
	updateStudent: async (id, data) => {
		const r = await api.put(`/admin/students/${id}`, data)
		return r.data.student
	},
	deleteStudent: async id => {
		await api.delete(`/admin/students/${id}`)
	},
	getStudentAvailability: async id => {
		const r = await api.get(`/admin/students/${id}/availability`)
		return r.data.availability || []
	},
	createStudentAvailability: async (id, data) => {
		const r = await api.post(`/admin/students/${id}/availability`, data)
		return r.data.availability
	},
	updateStudentAvailability: async (id, availId, data) => {
		const r = await api.put(
			`/admin/students/${id}/availability/${availId}`,
			data,
		)
		return r.data.availability
	},
	deleteStudentAvailability: async (id, availId) => {
		await api.delete(`/admin/students/${id}/availability/${availId}`)
	},

	// ========== ASSIGNMENTS ==========
	getAssignments: async (filters = {}) => {
		const r = await api.get('/admin/assignments', { params: filters })
		return r.data.assignments || []
	},
	createAssignment: async data => {
		const r = await api.post('/admin/assignments', data)
		return r.data.assignment
	},
	updateAssignment: async (id, data) => {
		const r = await api.put(`/admin/assignments/${id}`, data)
		return r.data.assignment
	},
	deleteAssignment: async id => {
		await api.delete(`/admin/assignments/${id}`)
	},

	// ========== WEEK OVERRIDES ==========
	getWeekOverrides: async weekStart => {
		const r = await api.get('/admin/assignment-week-overrides', {
			params: { week_start: weekStart },
		})
		return r.data.overrides || r.data || []
	},
	createWeekOverride: async (assignmentId, data) => {
		const r = await api.post(
			`/admin/assignments/${assignmentId}/weekly-override`,
			data,
		)
		return r.data
	},
	updateWeekOverride: async (assignmentId, overrideId, data) => {
		const r = await api.put(
			`/admin/assignments/${assignmentId}/weekly-override/${overrideId}`,
			data,
		)
		return r.data
	},
	deleteWeekOverride: async (assignmentId, overrideId) => {
		await api.delete(
			`/admin/assignments/${assignmentId}/weekly-override/${overrideId}`,
		)
	},

	// ========== SCHEDULES ==========
	getScheduleByWeek: async weekStart => {
		const r = await api.get('/admin/schedules', {
			params: { week_start: weekStart },
		})
		return r.data
	},
	getScheduleById: async id => {
		const r = await api.get(`/admin/schedules/${id}`)
		return r.data
	},
	generateSchedule: async weekStartDate => {
		const r = await api.post('/admin/schedules/generate', {
			week_start_date: weekStartDate,
		})
		return r.data
	},
	approveSchedule: async id => {
		const r = await api.post(`/admin/schedules/${id}/approve`)
		return r.data
	},
	resetAutoSchedule: async id => {
		const r = await api.post(`/admin/schedules/${id}/reset-auto`)
		return r.data
	},

	// ========== SCHEDULE SLOTS ==========
	createSlot: async (scheduleId, data) => {
		const r = await api.post(`/admin/schedules/${scheduleId}/slots`, data)
		return r.data
	},
	updateSlot: async (scheduleId, slotId, data) => {
		const r = await api.put(
			`/admin/schedules/${scheduleId}/slots/${slotId}`,
			data,
		)
		return r.data
	},
	deleteSlot: async (scheduleId, slotId) => {
		await api.delete(`/admin/schedules/${scheduleId}/slots/${slotId}`)
	},
}

export default scheduleService
