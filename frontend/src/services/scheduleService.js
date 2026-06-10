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
	deactivateSubject: async id => {
		await api.patch(`/admin/subjects/${id}/deactivate`)
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
	deactivateTeacher: async id => {
		await api.patch(`/admin/teachers/${id}/deactivate`)
	},
	activateTeacher: async id => {
		await api.patch(`/admin/teachers/${id}/activate`)
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
		const r = await api.put(`/admin/teachers/${id}/availability/${availId}`, data)
		return r.data.availability
	},
	deleteTeacherAvailability: async (id, availId) => {
		await api.delete(`/admin/teachers/${id}/availability/${availId}`)
	},
	getTeacherRooms: async id => {
		const r = await api.get(`/admin/teachers/${id}/rooms`)
		return r.data.teacher_rooms || []
	},
	updateTeacherRooms: async (id, roomIds, isStrict) => {
		const r = await api.put(`/admin/teachers/${id}/rooms`, {
			room_ids: roomIds,
			is_strict: isStrict,
		})
		return r.data.teacher_rooms || []
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
	deactivateRoom: async id => {
		await api.patch(`/admin/rooms/${id}/deactivate`)
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
	deactivateStudent: async id => {
		await api.patch(`/admin/students/${id}/deactivate`)
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
		const r = await api.put(`/admin/students/${id}/availability/${availId}`, data)
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

	// ========== GROUP LESSONS ==========
	getGroupLessons: async (filters = {}) => {
		const r = await api.get('/admin/group-lessons', { params: filters })
		return r.data.group_lessons || []
	},
	getGroupLessonById: async id => {
		const r = await api.get(`/admin/group-lessons/${id}`)
		return r.data.group_lesson
	},
	createGroupLesson: async data => {
		const r = await api.post('/admin/group-lessons', data)
		return r.data.group_lesson
	},
	updateGroupLesson: async (id, data) => {
		const r = await api.put(`/admin/group-lessons/${id}`, data)
		return r.data.group_lesson
	},
	deleteGroupLesson: async id => {
		await api.delete(`/admin/group-lessons/${id}`)
	},
	getGroupEnrollments: async id => {
		const r = await api.get(`/admin/group-lessons/${id}/enrollments`)
		return r.data.enrollments || []
	},
	addGroupEnrollment: async (id, studentId) => {
		const r = await api.post(`/admin/group-lessons/${id}/enrollments`, { student_id: studentId })
		return r.data.enrollment
	},
	removeGroupEnrollment: async (id, studentId) => {
		await api.delete(`/admin/group-lessons/${id}/enrollments/${studentId}`)
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
	startGenerateSchedule: async weekStartDate => {
		const r = await api.post('/admin/schedules/generate/async', {
			week_start_date: weekStartDate,
		})
		return r.data.job
	},
	getGenerationJob: async jobId => {
		const r = await api.get(`/admin/schedule-generation-jobs/${jobId}`)
		return r.data.job
	},
	approveSchedule: async id => {
		const r = await api.post(`/admin/schedules/${id}/approve`)
		return r.data
	},
	unapproveSchedule: async id => {
		const r = await api.post(`/admin/schedules/${id}/unapprove`)
		return r.data
	},
	resetAutoSchedule: async id => {
		const r = await api.post(`/admin/schedules/${id}/reset-auto`)
		return r.data
	},
	startResetAutoSchedule: async id => {
		const r = await api.post(`/admin/schedules/${id}/reset-auto/async`)
		return r.data.job
	},
	clearAutoSchedule: async id => {
		const r = await api.post(`/admin/schedules/${id}/clear-auto`)
		return r.data
	},

	// ========== SCHEDULE SLOTS ==========
	createEmptySchedule: async (weekStartDate) => {
		const r = await api.post('/admin/schedules', { week_start_date: weekStartDate })
		return r.data
	},
	createSlot: async (scheduleId, data, force = false) => {
		const url = force
			? `/admin/schedules/${scheduleId}/slots?force=true`
			: `/admin/schedules/${scheduleId}/slots`
		const r = await api.post(url, data)
		return r.data
	},
	updateSlot: async (scheduleId, slotId, data, force = false) => {
		const url = force
			? `/admin/schedules/${scheduleId}/slots/${slotId}?force=true`
			: `/admin/schedules/${scheduleId}/slots/${slotId}`
		const r = await api.put(url, data)
		return r.data
	},
	pinSlot: async (scheduleId, slotId) => {
		const r = await api.patch(`/admin/schedules/${scheduleId}/slots/${slotId}/pin`)
		return r.data
	},
	unpinSlot: async (scheduleId, slotId) => {
		const r = await api.patch(`/admin/schedules/${scheduleId}/slots/${slotId}/unpin`)
		return r.data
	},
	deleteSlot: async (scheduleId, slotId) => {
		await api.delete(`/admin/schedules/${scheduleId}/slots/${slotId}`)
	},
	// ========== SLOT ATTENDANCE ==========
	getSlotAttendance: async (scheduleId, slotId) => {
		const r = await api.get(`/admin/schedules/${scheduleId}/slots/${slotId}/attendance`)
		return r.data.attendance || []
	},
	addSlotStudent: async (scheduleId, slotId, studentId) => {
		const r = await api.post(`/admin/schedules/${scheduleId}/slots/${slotId}/attendance`, { student_id: studentId })
		return r.data.attendance
	},
	updateAttendance: async (scheduleId, slotId, studentId, attended) => {
		const r = await api.patch(`/admin/schedules/${scheduleId}/slots/${slotId}/attendance/${studentId}`, { attended })
		return r.data.attendance
	},
	removeSlotStudent: async (scheduleId, slotId, studentId) => {
		await api.delete(`/admin/schedules/${scheduleId}/slots/${slotId}/attendance/${studentId}`)
	},

	// ========== REPORTS ==========
	getMonthlyReport: async (year, month) => {
		const r = await api.get('/admin/reports/monthly', {
			params: { year, month },
		})
		return r.data
	},
	getTeacherReport: async (teacherId, startDate, endDate) => {
		const params = { start_date: startDate, end_date: endDate }
		if (teacherId) params.teacher_id = teacherId
		const r = await api.get('/admin/reports/monthly', { params })
		return r.data
	},
	getStudentReport: async (studentId, startDate, endDate) => {
		const params = { start_date: startDate, end_date: endDate }
		if (studentId) params.student_id = studentId
		const r = await api.get('/admin/reports/monthly', { params })
		return r.data
	},
	clearManualSlots: async scheduleId => {
		const r = await api.post(`/admin/schedules/${scheduleId}/clear-manual`)
		return r.data
	},
	copyManualSlotsFromPrevWeek: async scheduleId => {
		const r = await api.post(`/admin/schedules/${scheduleId}/copy-manual-from-prev-week`)
		return r.data
	},
	bulkUpdateSlotsOrigin: async (scheduleId, origin) => {
		const r = await api.patch(`/admin/schedules/${scheduleId}/slots/bulk-origin`, { origin })
		return r.data
	},
	// ========== USERS (admin) ==========
	getUsers: async () => {
		const r = await api.get('/admin/users')
		return r.data.users || []
	},
	createUser: async data => {
		const r = await api.post('/admin/users', data)
		return r.data.user
	},
	updateUser: async (id, data) => {
		const r = await api.put(`/admin/users/${id}`, data)
		return r.data.user
	},
	deleteUser: async (id) => {
		await api.delete(`/admin/users/${id}`)
	},
	getUserChildren: async userId => {
		const r = await api.get(`/admin/users/${userId}/children`)
		return r.data.children || []
	},
	addUserChild: async (userId, studentId) => {
		const r = await api.post(`/admin/users/${userId}/children`, { student_id: studentId })
		return r.data.link
	},
	removeUserChild: async (userId, studentId) => {
		await api.delete(`/admin/users/${userId}/children/${studentId}`)
	},

	// ========== PARENT SCHEDULE ==========
	getMyChildren: async () => {
		const r = await api.get('/my-children')
		return r.data.children || []
	},
	getChildSchedule: async (studentId, weekStart) => {
		const r = await api.get(`/my-children/${studentId}/schedule`, {
			params: { week_start: weekStart },
		})
		return r.data
	},
	getTeacherPublishedSchedule: async (weekStart, filters = {}) => {
		const params = { week_start: weekStart }
		if (filters.teacher_id) params.teacher_id = filters.teacher_id
		if (filters.student_id) params.student_id = filters.student_id
		const r = await api.get('/teacher/schedule', { params })
		return r.data
	},
	getTeacherScheduleOptions: async () => {
		const r = await api.get('/teacher/schedule/options')
		return r.data
	},
	getLinkedTeacher: async (userId) => {
		const r = await api.get(`/admin/users/${userId}/teacher`)
		return r.data
	},
	linkTeacherToUser: async (userId, teacherId) => {
		const r = await api.put(`/admin/users/${userId}/teacher`, { teacher_id: teacherId })
		return r.data
	},
	unlinkTeacherFromUser: async (userId) => {
		const r = await api.delete(`/admin/users/${userId}/teacher`)
		return r.data
	},
}

export default scheduleService
