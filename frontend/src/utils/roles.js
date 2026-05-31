/**
 * Central role-checking utilities.
 *
 * Add new privileged roles here — every component that imports these
 * functions will automatically pick up the change without touching its
 * own code.
 */

const ADMIN_ROLES = ['admin', 'superadmin']

/** True for any role that has administrator-level access. */
export const isAdmin = (role) => ADMIN_ROLES.includes(role)

/** True only for the highest-privilege role. */
export const isSuperAdmin = (role) => role === 'superadmin'

/** True for regular, non-privileged users. */
export const isRegularUser = (role) => role === 'user'

/** True for teachers. */
export const isTeacher = (role) => role === 'teacher'
