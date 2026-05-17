import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container, Paper, Typography, Box, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Switch, FormControlLabel, Chip, CircularProgress,
} from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ArrowBack as BackIcon } from '@mui/icons-material'
import { cmsFileService, uploadFile, getUploadUrl } from '../services/cmsService'

const emptyForm = { title: '', description: '', file_url: '', sort_order: 0, is_active: true }

export default function AdminCmsFiles({ section, title }) {
  const navigate = useNavigate()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = () => {
    setLoading(true)
    cmsFileService.getAllAdmin(section).then(setFiles).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [section])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, sort_order: files.length })
    setOpen(true)
  }

  const openEdit = (file) => {
    setEditing(file)
    setForm({ ...file })
    setOpen(true)
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadFile(file)
      setForm(f => ({ ...f, file_url: url }))
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...form, section }
      if (editing) {
        await cmsFileService.update(editing.id, payload)
      } else {
        await cmsFileService.create(payload)
      }
      setOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить файл?')) return
    await cmsFileService.delete(id)
    load()
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton onClick={() => navigate('/admin/cms')}><BackIcon /></IconButton>
            <Typography variant="h5">{title}</Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Добавить
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" mb={2}>
          Файлы отображаются в порядке поля «Порядок». Меньшее значение — выше.
        </Typography>

        {loading ? <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box> : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={80}>Порядок</TableCell>
                  <TableCell>Название</TableCell>
                  <TableCell>Описание</TableCell>
                  <TableCell>Файл</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell align="right">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {files.map(file => (
                  <TableRow key={file.id}>
                    <TableCell>{file.sort_order}</TableCell>
                    <TableCell>{file.title}</TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.description}
                    </TableCell>
                    <TableCell>
                      {file.file_url ? (
                        <a href={getUploadUrl(file.file_url)} target="_blank" rel="noreferrer">
                          Открыть
                        </a>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip label={file.is_active ? 'Активен' : 'Скрыт'} size="small"
                        color={file.is_active ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(file)}><EditIcon /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(file.id)}><DeleteIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Редактировать файл' : 'Добавить файл'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Раздел"
            value={title}
            fullWidth
            InputProps={{ readOnly: true }}
            size="small"
            sx={{ bgcolor: 'action.hover', borderRadius: 1 }}
          />
          <TextField label="Название документа" value={form.title} fullWidth required
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />

          <TextField label="Описание (необязательно)" value={form.description} fullWidth multiline rows={2}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

          <Box>
            <Typography variant="body2" color="text.secondary" mb={1}>Файл PDF</Typography>
            {form.file_url && (
              <Box mb={1}>
                <a href={getUploadUrl(form.file_url)} target="_blank" rel="noreferrer">
                  Текущий файл
                </a>
              </Box>
            )}
            <Button variant="outlined" component="label" disabled={uploading}>
              {uploading ? 'Загружается...' : 'Загрузить файл'}
              <input type="file" accept=".pdf,.doc,.docx" hidden onChange={handleFileUpload} />
            </Button>
          </Box>

          <TextField label="Порядок отображения" type="number" value={form.sort_order}
            helperText="Меньшее число — выше в списке"
            onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />

          <FormControlLabel
            control={<Switch checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />}
            label="Отображать на сайте" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.title}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
