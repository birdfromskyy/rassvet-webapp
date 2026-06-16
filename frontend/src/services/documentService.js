import api from './api'

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080/api'

const documentService = {
  /** Fetch current user's parent profile + child submissions */
  getMyDocuments: () => api.get('/documents').then(r => r.data),

  /** Delete own parent profile (files + record) */
  deleteMyParentProfile: () => api.delete('/documents/parent').then(r => r.data),

  /**
   * Save parent profile docs (phone, passport files, snils files).
   * keepPassport / keepSnils — arrays of existing filenames to retain.
   * passportFiles / snilsFiles — File[] arrays of new uploads.
   */
  saveParentDocs: ({ phone, keepPassport, keepSnils, passportFiles, snilsFiles }) => {
    const form = new FormData()
    if (phone) form.append('phone', phone)
    form.append('keep_passport', JSON.stringify(keepPassport || []))
    form.append('keep_snils', JSON.stringify(keepSnils || []))
    ;(passportFiles || []).forEach(f => form.append('passport_files', f))
    ;(snilsFiles || []).forEach(f => form.append('snils_files', f))
    return api.post('/documents/parent', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },

  /**
   * Add a new child doc submission.
   * ippsuFiles / birthCertFiles / childSnilsFiles — File[] arrays.
   */
  addChildDocs: ({ childName, ippsuFiles, birthCertFiles, childSnilsFiles }) => {
    const form = new FormData()
    form.append('child_name', childName)
    ;(ippsuFiles || []).forEach(f => form.append('ippsu_files', f))
    ;(birthCertFiles || []).forEach(f => form.append('birth_cert_files', f))
    ;(childSnilsFiles || []).forEach(f => form.append('child_snils_files', f))
    return api.post('/documents/children', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },

  /** Delete a child submission by id */
  deleteChildSubmission: (id) => api.delete(`/documents/children/${id}`).then(r => r.data),

  /**
   * Update a rejected child submission and resubmit for review.
   * keepIppsu / keepBirth / keepChildSnils — existing filenames to retain.
   */
  updateChildDocs: (id, { childName, keepIppsu, keepBirth, keepChildSnils, ippsuFiles, birthCertFiles, childSnilsFiles }) => {
    const form = new FormData()
    form.append('child_name', childName)
    form.append('keep_ippsu_files', JSON.stringify(keepIppsu || []))
    form.append('keep_birth_cert_files', JSON.stringify(keepBirth || []))
    form.append('keep_child_snils_files', JSON.stringify(keepChildSnils || []))
    ;(ippsuFiles || []).forEach(f => form.append('ippsu_files', f))
    ;(birthCertFiles || []).forEach(f => form.append('birth_cert_files', f))
    ;(childSnilsFiles || []).forEach(f => form.append('child_snils_files', f))
    return api.put(`/documents/children/${id}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },

  /** Build URL for a private file — httpOnly cookie is sent automatically by the browser */
  fileUrl: (filename) => `${BASE}/documents/file/${filename}`,

  // ── Admin ──────────────────────────────────────────────────────────────────

  /** List all users with documents (admin only) */
  adminListDocuments: () => api.get('/admin/documents').then(r => r.data),

  /** Update status of a child submission */
  adminUpdateSubmissionStatus: (id, status, adminNote = '', ippsuExpiryDate = '') =>
    api.put(`/admin/documents/submissions/${id}/status`, {
      status,
      admin_note: adminNote,
      ...(ippsuExpiryDate ? { ippsu_expiry_date: ippsuExpiryDate } : {}),
    }).then(r => r.data),

  /** Admin anonymizes a child submission: deletes files, clears PII, keeps record + status */
  adminAnonymizeSubmission: (id) =>
    api.post(`/admin/documents/submissions/${id}/anonymize`).then(r => r.data),

  /** Admin hard-deletes a child submission + files completely from DB */
  adminDeleteSubmission: (id) =>
    api.delete(`/admin/documents/submissions/${id}`).then(r => r.data),

  /** Admin clears parent profile PII (files + phone), keeps the record + status */
  adminAnonymizeParentProfile: (userId) =>
    api.post(`/admin/documents/parent/${userId}/anonymize`).then(r => r.data),

  /** Admin deletes parent profile record + files (phone, passport, snils) */
  adminDeleteParentProfile: (userId) =>
    api.delete(`/admin/documents/parent/${userId}`).then(r => r.data),

  /** Update status of parent profile (and optional admin note) */
  adminUpdateParentStatus: (userId, status, adminNote = '') =>
    api.put(`/admin/documents/parent/${userId}/status`, { status, admin_note: adminNote }).then(r => r.data),

  /** Erase all personal data (children docs + parent phone/files) for a user */
  adminDeletePersonalData: (userId) =>
    api.delete(`/admin/documents/user/${userId}/personal-data`).then(r => r.data),
}

export default documentService
