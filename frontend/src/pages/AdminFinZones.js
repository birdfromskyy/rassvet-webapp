import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container, Paper, Typography, Box, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Switch, FormControlLabel, Chip, CircularProgress,
} from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ArrowBack as BackIcon } from '@mui/icons-material'
import { finZoneService, uploadFile, getUploadUrl } from '../services/cmsService'

const emptyForm = { title: '', accent: '', text: '', image_url: '', items: '', sort_order: 0, is_active: true }

export default function AdminFinZones() {
  const navigate = useNavigate()
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [itemsText, setItemsText] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = () => {
    setLoading(true)
    finZoneService.getAllAdmin().then(setZones).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, sort_order: zones.length })
    setItemsText('')
    setOpen(true)
  }

  const openEdit = (zone) => {
    setEditing(zone)
    setForm({ ...zone })
    try { setItemsText(JSON.parse(zone.items || '[]').join('\n')) } catch { setItemsText('') }
    setOpen(true)
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadFile(file)
      setForm(f => ({ ...f, image_url: url }))
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const items = JSON.stringify(itemsText.split('\n').map(s => s.trim()).filter(Boolean))
      const payload = { ...form, items }

      if (editing) {
        await finZoneService.update(editing.id, payload)
      } else {
        await finZoneService.create(payload)
      }
      setOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить зону?')) return
    await finZoneService.delete(id)
    load()
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton onClick={() => navigate('/admin/cms')}><BackIcon /></IconButton>
            <Typography variant="h5">Материальная база (помещения)</Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Добавить зону
          </Button>
        </Box>

        {loading ? <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box> : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={80}>Порядок</TableCell>
                  <TableCell>Название</TableCell>
                  <TableCell>Метка</TableCell>
                  <TableCell>Фото</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell align="right">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {zones.map(zone => (
                  <TableRow key={zone.id}>
                    <TableCell>{zone.sort_order}</TableCell>
                    <TableCell>{zone.title}</TableCell>
                    <TableCell>{zone.accent}</TableCell>
                    <TableCell>
                      {zone.image_url
                        ? <img src={getUploadUrl(zone.image_url)} alt="" height={40} style={{ borderRadius: 4 }} />
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip label={zone.is_active ? 'Активна' : 'Скрыта'} size="small"
                        color={zone.is_active ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(zone)}><EditIcon /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(zone.id)}><DeleteIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Редактировать зону' : 'Добавить зону'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Название зоны" value={form.title} fullWidth required
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />

          <TextField label="Метка (accent)" value={form.accent} fullWidth
            onChange={e => setForm(f => ({ ...f, accent: e.target.value }))}
            helperText="Пример: Планировка, Оборудование" />

          <TextField label="Описание (необязательно)" value={form.text} fullWidth multiline rows={3}
            onChange={e => setForm(f => ({ ...f, text: e.target.value }))} />

          <TextField
            label="Список элементов (каждый с новой строки)"
            value={itemsText} fullWidth multiline rows={5}
            onChange={e => setItemsText(e.target.value)} />

          <Box>
            <Typography variant="body2" color="text.secondary" mb={1}>Фото зоны</Typography>
            {form.image_url && (
              <Box mb={1}>
                <img src={getUploadUrl(form.image_url)} alt="" height={80}
                  style={{ borderRadius: 4, objectFit: 'cover' }} />
              </Box>
            )}
            <Button variant="outlined" component="label" disabled={uploading}>
              {uploading ? 'Загружается...' : 'Загрузить фото'}
              <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
            </Button>
          </Box>

          <TextField label="Порядок отображения" type="number" value={form.sort_order}
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
