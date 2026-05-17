import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container, Paper, Typography, Box, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Switch, FormControlLabel, Chip, CircularProgress, MenuItem, Select,
  FormControl, InputLabel,
} from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ArrowBack as BackIcon } from '@mui/icons-material'
import { employeeService, uploadFile, getUploadUrl } from '../services/cmsService'

const CATEGORIES = ['Руководство', 'Специалисты']

const emptyForm = {
  name: '', category: 'Специалисты', photo_url: '',
  qualifications: '', education: '', experience: '', sort_order: 0, is_active: true,
}

export default function AdminEmployees() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // qualifications and education are edited as newline-separated text
  const [qualText, setQualText] = useState('')
  const [eduText, setEduText] = useState('')

  const load = () => {
    setLoading(true)
    employeeService.getAllAdmin().then(setEmployees).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setQualText('')
    setEduText('')
    setOpen(true)
  }

  const openEdit = (emp) => {
    setEditing(emp)
    setForm({ ...emp, is_active: emp.is_active })
    try { setQualText(JSON.parse(emp.qualifications || '[]').join('\n')) } catch { setQualText('') }
    try { setEduText(JSON.parse(emp.education || '[]').join('\n')) } catch { setEduText('') }
    setOpen(true)
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadFile(file)
      setForm(f => ({ ...f, photo_url: url }))
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const qualifications = JSON.stringify(qualText.split('\n').map(s => s.trim()).filter(Boolean))
      const education = JSON.stringify(eduText.split('\n').map(s => s.trim()).filter(Boolean))
      const payload = { ...form, qualifications, education }

      if (editing) {
        await employeeService.update(editing.id, payload)
      } else {
        await employeeService.create(payload)
      }
      setOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить сотрудника?')) return
    await employeeService.delete(id)
    load()
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton onClick={() => navigate('/dashboard')}><BackIcon /></IconButton>
            <Typography variant="h5">Сотрудники</Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Добавить
          </Button>
        </Box>

        {loading ? <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box> : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Порядок</TableCell>
                  <TableCell>ФИО</TableCell>
                  <TableCell>Категория</TableCell>
                  <TableCell>Опыт</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell align="right">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {employees.map(emp => (
                  <TableRow key={emp.id}>
                    <TableCell>{emp.sort_order}</TableCell>
                    <TableCell>{emp.name}</TableCell>
                    <TableCell>
                      <Chip label={emp.category} size="small"
                        color={emp.category === 'Руководство' ? 'primary' : 'default'} />
                    </TableCell>
                    <TableCell>{emp.experience}</TableCell>
                    <TableCell>
                      <Chip label={emp.is_active ? 'Активен' : 'Скрыт'} size="small"
                        color={emp.is_active ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(emp)}><EditIcon /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(emp.id)}><DeleteIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? 'Редактировать сотрудника' : 'Добавить сотрудника'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="ФИО" value={form.name} fullWidth required
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

          <FormControl fullWidth>
            <InputLabel>Категория</InputLabel>
            <Select value={form.category} label="Категория"
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>

          <Box>
            <Typography variant="body2" color="text.secondary" mb={1}>Фото сотрудника</Typography>
            {form.photo_url && (
              <Box mb={1}>
                <img src={getUploadUrl(form.photo_url)} alt="" height={80}
                  style={{ borderRadius: 4, objectFit: 'cover' }} />
              </Box>
            )}
            <Button variant="outlined" component="label" disabled={uploading}>
              {uploading ? 'Загружается...' : 'Загрузить фото'}
              <input type="file" accept="image/*" hidden onChange={handlePhotoUpload} />
            </Button>
          </Box>

          <TextField label="Квалификации (каждая с новой строки)" value={qualText} fullWidth multiline rows={4}
            onChange={e => setQualText(e.target.value)}
            helperText="Пример: Педагог-психолог" />

          <TextField label="Образование (каждое учреждение с новой строки)" value={eduText} fullWidth multiline rows={4}
            onChange={e => setEduText(e.target.value)} />

          <TextField label="Опыт работы" value={form.experience} fullWidth
            onChange={e => setForm(f => ({ ...f, experience: e.target.value }))}
            helperText="Пример: С октября 2021" />

          <TextField label="Порядок отображения" type="number" value={form.sort_order}
            onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />

          <FormControlLabel
            control={<Switch checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />}
            label="Отображать на сайте" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
