import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container, Paper, Typography, Box, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  CircularProgress,
} from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ArrowBack as BackIcon } from '@mui/icons-material'
import { historyService } from '../services/cmsService'

const emptyForm = { year: '', items: '', sort_order: 0 }

export default function AdminHistory() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [itemsText, setItemsText] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    historyService.getAll().then(setEvents).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, sort_order: events.length })
    setItemsText('')
    setOpen(true)
  }

  const openEdit = (event) => {
    setEditing(event)
    setForm({ year: event.year, sort_order: event.sort_order })
    try { setItemsText(JSON.parse(event.items || '[]').join('\n')) } catch { setItemsText('') }
    setOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const items = JSON.stringify(itemsText.split('\n').map(s => s.trim()).filter(Boolean))
      const payload = { year: form.year, items, sort_order: form.sort_order }

      if (editing) {
        await historyService.update(editing.id, payload)
      } else {
        await historyService.create(payload)
      }
      setOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить запись?')) return
    await historyService.delete(id)
    load()
  }

  const parseItems = (str) => {
    try { return JSON.parse(str || '[]'); } catch { return []; }
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton onClick={() => navigate('/admin/cms')}><BackIcon /></IconButton>
            <Typography variant="h5">История и достижения</Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Добавить год
          </Button>
        </Box>

        {loading ? <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box> : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={80}>Порядок</TableCell>
                  <TableCell width={100}>Год</TableCell>
                  <TableCell>Достижения</TableCell>
                  <TableCell align="right">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map(ev => (
                  <TableRow key={ev.id}>
                    <TableCell>{ev.sort_order}</TableCell>
                    <TableCell><strong>{ev.year}</strong></TableCell>
                    <TableCell>
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {parseItems(ev.items).map((item, i) => (
                          <li key={i} style={{ fontSize: 13 }}>{item}</li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(ev)}><EditIcon /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(ev.id)}><DeleteIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Редактировать год' : 'Добавить год'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Год" value={form.year} fullWidth required
            onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
            helperText="Например: 2025" />

          <TextField
            label="Достижения (каждое с новой строки)"
            value={itemsText}
            fullWidth multiline rows={6}
            onChange={e => setItemsText(e.target.value)}
            helperText="Каждая строка — отдельное достижение"
          />

          <TextField label="Порядок отображения" type="number" value={form.sort_order}
            onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.year}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
