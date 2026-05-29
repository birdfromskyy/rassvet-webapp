import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Chip,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  ExpandMore as ExpandIcon,
  OpenInNew as OpenIcon,
  HourglassTop as PendingIcon,
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import documentService from '../services/documentService'

// ── Helpers ──────────────────────────────────────────────────────────────────
const safeParseJSON = (str) => {
  try {
    const val = JSON.parse(str)
    return Array.isArray(val) ? val : []
  } catch { return [] }
}

const formatPhone = (raw) => {
  if (!raw) return '—'
  const d = raw.replace(/\D/g, '')
  if (d.length !== 11) return raw
  return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`
}

const STATUS_META = {
  draft:    { label: 'Черновик',    color: 'default' },
  pending:  { label: 'На проверке', color: 'warning' },
  verified: { label: 'Подтверждён', color: 'success' },
  approved: { label: 'Принято',     color: 'success' },
  rejected: { label: 'Отклонено',   color: 'error' },
}

const StatusChip = ({ status }) => {
  const m = STATUS_META[status] || { label: status, color: 'default' }
  return <Chip label={m.label} color={m.color} size="small" />
}

const openPrivateFile = (filename) => {
  const token = localStorage.getItem('token')
  const base  = process.env.REACT_APP_API_URL || 'http://localhost:8080/api'
  const url   = `${base}/documents/file/${filename}${token ? `?token=${encodeURIComponent(token)}` : ''}`
  window.open(url, '_blank')
}

const FileLinks = ({ files }) => {
  const list = safeParseJSON(files)
  if (list.length === 0) return (
    <Typography variant="caption" color="text.disabled">не загружено</Typography>
  )
  return (
    <Box display="flex" flexWrap="wrap" gap={0.5}>
      {list.map(fn => (
        <Chip
          key={fn}
          label={fn.slice(0, 22) + (fn.length > 22 ? '…' : '')}
          size="small" variant="outlined"
          icon={<OpenIcon fontSize="inherit" />}
          onClick={() => openPrivateFile(fn)}
          sx={{ cursor: 'pointer' }}
        />
      ))}
    </Box>
  )
}

// ── Parent status dialog ──────────────────────────────────────────────────────
const StatusDialog = ({ open, title, currentStatus, statusOptions, onClose, onSave }) => {
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setStatus(currentStatus || (statusOptions[0]?.value ?? ''))
  }, [open, currentStatus, statusOptions])

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(status); toast.success('Статус обновлён'); onClose() }
    catch { toast.error('Ошибка обновления статуса') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Статус</InputLabel>
            <Select value={status} label="Статус" onChange={e => setStatus(e.target.value)}>
              {statusOptions.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Child submission dialog (with ИППСУ expiry date) ─────────────────────────
const ChildStatusDialog = ({ open, submission, onClose, onSave }) => {
  const [status, setStatus]     = useState('')
  const [note, setNote]         = useState('')
  const [expiryDate, setExpiry] = useState('')
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    if (open && submission) {
      setStatus(submission.status || 'pending')
      setNote(submission.admin_note || '')
      setExpiry(submission.ippsu_expiry_date ? submission.ippsu_expiry_date.slice(0, 10) : '')
    }
  }, [open, submission])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(status, note, expiryDate)
      toast.success('Статус обновлён')
      onClose()
    } catch { toast.error('Ошибка обновления статуса') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Статус документов: {submission?.child_name ?? ''}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Статус</InputLabel>
            <Select value={status} label="Статус" onChange={e => setStatus(e.target.value)}>
              {CHILD_STATUS_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {status === 'approved' && (
            <TextField
              label="Срок действия ИППСУ"
              type="date"
              value={expiryDate}
              onChange={e => setExpiry(e.target.value)}
              fullWidth size="small"
              InputLabelProps={{ shrink: true }}
              helperText="Когда срок истечёт — пользователь и администратор получат уведомление на сайте"
            />
          )}

          <TextField
            label="Примечание для родителя"
            value={note}
            onChange={e => setNote(e.target.value)}
            fullWidth size="small" multiline rows={3}
            helperText="Причина отклонения или комментарий (видит родитель)"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const CHILD_STATUS_OPTIONS = [
  { value: 'pending',  label: 'На проверке' },
  { value: 'approved', label: 'Принято' },
  { value: 'rejected', label: 'Отклонено' },
]

const PARENT_STATUS_OPTIONS = [
  { value: 'pending',  label: 'На проверке' },
  { value: 'verified', label: 'Подтверждён' },
  { value: 'draft',    label: 'Черновик' },
]

// ── Delete confirmation dialog ────────────────────────────────────────────────
const DeleteDialog = ({ open, title, description, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false)
  const handle = async () => {
    setLoading(true)
    try { await onConfirm(); onClose() }
    catch { toast.error('Ошибка удаления') }
    finally { setLoading(false) }
  }
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">{description}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" color="error" onClick={handle} disabled={loading}>
          {loading ? 'Удаление...' : 'Удалить'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
const AdminDocuments = () => {
  const navigate = useNavigate()
  const [list, setList]       = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  // Dialogs
  const [childDialog, setChildDialog]         = useState({ open: false, submission: null })
  const [parentDialog, setParentDialog]       = useState({ open: false, userId: null, status: '' })
  const [deleteDialog, setDeleteDialog]       = useState({ open: false, submission: null })
  const [deleteParentDialog, setDeleteParentDialog] = useState({ open: false, userId: null, email: '' })

  const load = useCallback(async () => {
    try {
      const data = await documentService.adminListDocuments()
      setList(data || [])
    } catch {
      toast.error('Ошибка загрузки документов')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const q = search.trim().toLowerCase()
  const filtered = q
    ? list.filter(u =>
        [u.email, u.full_name, String(u.user_id)]
          .filter(Boolean).join(' ').toLowerCase().includes(q)
      )
    : list

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4">Документы родителей</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Проверка и подтверждение документов, поданных пользователями
            </Typography>
          </Box>
          <Button startIcon={<BackIcon />} onClick={() => navigate(-1)}>Назад</Button>
        </Box>

        <TextField
          label="Поиск по email, ФИО или ID"
          value={search}
          onChange={e => setSearch(e.target.value)}
          fullWidth size="small" sx={{ mb: 3 }}
        />

        {loading ? (
          <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
        ) : filtered.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
            Документы не найдены
          </Typography>
        ) : (
          filtered.map(userDoc => {
            const profile  = userDoc.parent_profile
            const children = userDoc.children || []
            const pendingCount = children.filter(c => c.status === 'pending').length

            return (
              <Accordion key={userDoc.user_id} sx={{ mb: 1.5 }}>
                <AccordionSummary expandIcon={<ExpandIcon />}>
                  <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                    <Typography fontWeight={700}>{userDoc.full_name || '—'}</Typography>
                    <Typography variant="body2" color="text.secondary">{userDoc.email}</Typography>
                    {pendingCount > 0 && (
                      <Chip
                        label={`${pendingCount} на проверке`}
                        color="warning" size="small"
                        icon={<PendingIcon fontSize="inherit" />}
                      />
                    )}
                  </Box>
                </AccordionSummary>

                <AccordionDetails>
                  {/* ── Parent profile ── */}
                  <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                    Документы родителя
                  </Typography>

                  {profile ? (
                    <Box>
                      <Box display="flex" alignItems="center" gap={2} mb={1.5} flexWrap="wrap">
                        <Typography variant="body2">
                          Телефон: <strong>{formatPhone(profile.phone)}</strong>
                        </Typography>
                        <StatusChip status={profile.status} />
                        <Button
                          size="small" variant="outlined"
                          onClick={() => setParentDialog({
                            open: true,
                            userId: userDoc.user_id,
                            status: profile.status || 'pending',
                          })}
                        >
                          Изменить статус
                        </Button>
                        <Button
                          size="small" variant="outlined" color="error"
                          onClick={() => setDeleteParentDialog({
                            open: true,
                            userId: userDoc.user_id,
                            email: userDoc.email,
                          })}
                        >
                          Удалить данные
                        </Button>
                      </Box>

                      <Table size="small" sx={{ mb: 2 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell>Документ</TableCell>
                            <TableCell>Файлы</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell>Паспорт</TableCell>
                            <TableCell><FileLinks files={profile.passport_files} /></TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>СНИЛС родителя</TableCell>
                            <TableCell><FileLinks files={profile.snils_files} /></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
                      Родитель ещё не заполнил личные документы
                    </Typography>
                  )}

                  <Divider sx={{ my: 2 }} />

                  {/* ── Children submissions ── */}
                  <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                    Документы детей ({children.length})
                  </Typography>

                  {children.length === 0 ? (
                    <Typography variant="body2" color="text.disabled">
                      Документы детей не поданы
                    </Typography>
                  ) : (
                    children.map(ch => (
                      <Box
                        key={ch.id}
                        sx={{
                          border: '1px solid', borderColor: 'divider',
                          borderRadius: 2, p: 2, mb: 1.5,
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={2} mb={1} flexWrap="wrap">
                          <Typography fontWeight={600}>{ch.child_name}</Typography>
                          <StatusChip status={ch.status} />
                          {ch.ippsu_expiry_date && (
                            <Chip
                              size="small"
                              label={`ИППСУ до: ${new Date(ch.ippsu_expiry_date).toLocaleDateString('ru-RU')}`}
                              color={new Date(ch.ippsu_expiry_date) < new Date() ? 'error' : 'default'}
                              variant="outlined"
                            />
                          )}
                          <Button
                            size="small" variant="outlined"
                            onClick={() => setChildDialog({ open: true, submission: ch })}
                          >
                            Изменить статус
                          </Button>
                          <Button
                            size="small" variant="outlined" color="error"
                            onClick={() => setDeleteDialog({ open: true, submission: ch })}
                          >
                            Удалить заявку
                          </Button>
                        </Box>

                        {ch.admin_note && (
                          <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                            Примечание: {ch.admin_note}
                          </Typography>
                        )}

                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Документ</TableCell>
                              <TableCell>Файлы</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            <TableRow>
                              <TableCell>ИППСУ</TableCell>
                              <TableCell><FileLinks files={ch.ippsu_files} /></TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Свидетельство о рождении</TableCell>
                              <TableCell><FileLinks files={ch.birth_cert_files} /></TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>СНИЛС ребёнка</TableCell>
                              <TableCell><FileLinks files={ch.child_snils_files} /></TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </Box>
                    ))
                  )}
                </AccordionDetails>
              </Accordion>
            )
          })
        )}
      </Paper>

      {/* ── Child status dialog ── */}
      <ChildStatusDialog
        open={childDialog.open}
        submission={childDialog.submission}
        onClose={() => setChildDialog({ open: false, submission: null })}
        onSave={(status, note, expiryDate) =>
          documentService.adminUpdateSubmissionStatus(childDialog.submission.id, status, note, expiryDate)
            .then(load)
        }
      />

      {/* ── Parent status dialog ── */}
      <StatusDialog
        open={parentDialog.open}
        title="Статус документов родителя"
        currentStatus={parentDialog.status}
        statusOptions={PARENT_STATUS_OPTIONS}
        onClose={() => setParentDialog({ open: false, userId: null, status: '' })}
        onSave={(status) =>
          documentService.adminUpdateParentStatus(parentDialog.userId, status)
            .then(load)
        }
      />

      {/* ── Delete submission dialog ── */}
      <DeleteDialog
        open={deleteDialog.open}
        title="Удалить заявку"
        description={`Удалить заявку «${deleteDialog.submission?.child_name ?? ''}»? Все прикреплённые файлы будут удалены безвозвратно.`}
        onClose={() => setDeleteDialog({ open: false, submission: null })}
        onConfirm={() =>
          documentService.adminDeleteSubmission(deleteDialog.submission.id)
            .then(() => { toast.success('Заявка удалена'); load() })
        }
      />

      {/* ── Delete parent profile dialog ── */}
      <DeleteDialog
        open={deleteParentDialog.open}
        title="Удалить данные родителя"
        description={`Удалить паспорт, СНИЛС и номер телефона пользователя ${deleteParentDialog.email}? Файлы будут удалены безвозвратно.`}
        onClose={() => setDeleteParentDialog({ open: false, userId: null, email: '' })}
        onConfirm={() =>
          documentService.adminDeleteParentProfile(deleteParentDialog.userId)
            .then(() => { toast.success('Данные родителя удалены'); load() })
        }
      />
    </Container>
  )
}

export default AdminDocuments
