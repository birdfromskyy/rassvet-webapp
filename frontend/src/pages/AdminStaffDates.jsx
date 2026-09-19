import './AdminModule.scss';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField } from '@mui/material';
import { ArrowBack, Edit, Settings } from '@mui/icons-material';
import useBrandFont from '../hooks/useBrandFont';
import service from '../services/staffEventsService';

const roles = { teacher: 'Преподаватель', admin: 'Администратор', superadmin: 'Суперадминистратор' };
const dateLabel = value => value ? value.split('-').reverse().join('.') : 'Не указана';
const dateInputValue = value => value ? String(value).slice(0, 10) : '';
const failure = error => error.response?.status === 409 ? 'Запись уже изменена. Введённые значения оставлены на экране. Закройте окно и обновите список.' : error.response?.data?.error || 'Не удалось сохранить. Проверьте соединение и повторите попытку.';
export function sortStaff(rows, tab, direction) {
  const field = tab === 0 ? 'medical_days' : 'birthday_days';
  return [...rows].sort((a, b) => {
    if (a[field] == null) return b[field] == null ? a.name.localeCompare(b.name, 'ru') : 1;
    if (b[field] == null) return -1;
    return (a[field] - b[field]) * direction || a.name.localeCompare(b.name, 'ru');
  });
}

export default function AdminStaffDates() {
  useBrandFont();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [rows, setRows] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [direction, setDirection] = useState(1);
  const [inactive, setInactive] = useState(false);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [draft, setDraft] = useState(null);
  const [hour, setHour] = useState(9);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    Promise.all([service.list(controller.signal), service.recipients(controller.signal)]).then(([data, recipients]) => {
      if (controller.signal.aborted) return;
      setRows(data.staff); setHour(data.reminder_hour); setRecipients(recipients);
    }).catch(() => { if (!controller.signal.aborted) setError('Не удалось загрузить данные сотрудников'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  const save = async () => {
    setBusy(true); setDialogError('');
    try {
      if (draft.type === 'dates') await service.save(draft.row.kind, draft.row.owner_id, { revision: draft.row.dates.revision || 0, birth_date: draft.birth_date || null, medical_until: draft.medical_until || null });
      else await service.configure(draft.row.id, { revision: draft.row.revision, medical: draft.medical, birthdays: draft.birthdays });
      setDraft(null); setReload(n => n + 1);
    } catch (e) { setDialogError(failure(e)); }
    finally { setBusy(false); }
  };
  const close = () => { if (!busy) setDraft(null); };
  const visible = sortStaff(rows.filter(row => (inactive || row.active) && (role === 'all' || row.role === role) && row.name.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))), tab, direction);
  return <main className='admin-module'><div className='admin-module__container'>
    <section className='admin-module__hero'><div><span className='admin-module__badge'>Настройки системы</span><h1>Даты сотрудников</h1></div><Button className='admin-module__button admin-module__button--ghost' startIcon={<ArrowBack />} onClick={() => navigate('/admin/cms')}>Назад</Button></section>
    <section className='admin-module__panel'>
      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant='scrollable' allowScrollButtonsMobile sx={{ mb: 3 }}><Tab label='Медосмотры' /><Tab label='Дни рождения' /><Tab label='Получатели VK' /></Tabs>
      {error && <Alert severity='error' action={<Button onClick={() => setReload(n => n + 1)}>Повторить</Button>}>{error}</Alert>}
      {loading && <CircularProgress aria-label='Загрузка сотрудников' />}
      {!loading && !error && (tab === 2 ? <>
        <Alert severity='info' sx={{ mb: 2 }}>Напоминания в {String(hour).padStart(2, '0')}:00 по времени центра (UTC+5). Медосмотр: за 20 дней и в день окончания. День рождения: за 2 дня.</Alert>
        <Button variant='outlined' sx={{ mb: 2 }} onClick={() => navigate('/admin/cms/vk-notifications')}>Добавить или настроить страницу VK</Button>
        <TableContainer><Table><TableHead><TableRow><TableCell>Получатель</TableCell><TableCell>Медосмотры</TableCell><TableCell>Дни рождения</TableCell><TableCell /></TableRow></TableHead><TableBody>
          {recipients.map(row => <TableRow key={row.id}><TableCell>{row.profile_url}{!row.enabled && <Chip sx={{ ml: 1 }} label='Доставка отключена' size='small' />}</TableCell><TableCell>{row.medical ? 'Включены' : 'Выключены'}</TableCell><TableCell>{row.birthdays ? 'Включены' : 'Выключены'}</TableCell><TableCell><Button variant='outlined' startIcon={<Settings />} onClick={() => { setDialogError(''); setDraft({ type: 'recipient', row, medical: row.medical, birthdays: row.birthdays }); }}>Настроить</Button></TableCell></TableRow>)}
          {!recipients.length && <TableRow><TableCell colSpan={4}>Получатели VK ещё не добавлены</TableCell></TableRow>}
        </TableBody></Table></TableContainer>
      </> : <>
        <Box display='flex' gap={2} flexWrap='wrap' mb={2}>
          <TextField label='Поиск по ФИО' value={query} onChange={e => setQuery(e.target.value)} sx={{ flex: '1 1 240px' }} />
          <TextField select label='Должность' value={role} onChange={e => setRole(e.target.value)} sx={{ minWidth: 180 }}><MenuItem value='all'>Все</MenuItem>{Object.entries(roles).map(([id, title]) => <MenuItem key={id} value={id}>{title}</MenuItem>)}</TextField>
          <TextField select label='Сортировка' value={direction} onChange={e => setDirection(Number(e.target.value))} sx={{ minWidth: 180 }}><MenuItem value={1}>Сначала ближайшие</MenuItem><MenuItem value={-1}>Сначала дальние</MenuItem></TextField>
        </Box>
        <Box display='flex' justifyContent='space-between' flexWrap='wrap' mb={2}><FormControlLabel label='Показывать неактивных' control={<Checkbox checked={inactive} onChange={e => setInactive(e.target.checked)} />} /><Button onClick={() => setReload(n => n + 1)}>Обновить список</Button></Box>
        <TableContainer><Table><TableHead><TableRow><TableCell>Сотрудник</TableCell><TableCell>Должность</TableCell><TableCell>{tab === 0 ? 'Медосмотр до' : 'Дата рождения'}</TableCell><TableCell>{tab === 0 ? 'Срок' : 'Ближайший день рождения'}</TableCell><TableCell /></TableRow></TableHead><TableBody>
          {visible.map(row => { const days = tab === 0 ? row.medical_days : row.birthday_days; return <TableRow key={`${row.kind}/${row.owner_id}`}><TableCell>{row.name}{!row.active && <Chip size='small' label='Неактивен' sx={{ ml: 1 }} />}</TableCell><TableCell>{roles[row.role]}</TableCell><TableCell>{dateLabel(tab === 0 ? row.dates.medical_until : row.dates.birth_date)}</TableCell><TableCell>{days == null ? '—' : <Chip size='small' color={days < 0 ? 'error' : days <= (tab === 0 ? 20 : 2) ? 'warning' : 'success'} label={days < 0 ? `Просрочен на ${-days} дн.` : days === 0 ? 'Сегодня' : `Через ${days} дн.${tab === 1 ? ` · ${dateLabel(row.next_birthday)}` : ''}`} />}</TableCell><TableCell><Button variant='outlined' startIcon={<Edit />} onClick={() => { setDialogError(''); setDraft({ type: 'dates', row, birth_date: dateInputValue(row.dates.birth_date), medical_until: dateInputValue(row.dates.medical_until) }); }}>Изменить</Button></TableCell></TableRow>; })}
          {!visible.length && <TableRow><TableCell colSpan={5}>Сотрудники не найдены</TableCell></TableRow>}
        </TableBody></Table></TableContainer>
        {tab === 1 && <Box component='p' sx={{ color: 'text.secondary', fontSize: 13 }}>Для 29 февраля в невисокосный год используется 28 февраля.</Box>}
      </>)}
    </section>
    {draft && <Dialog open onClose={close} fullWidth maxWidth='sm'><DialogTitle>{draft.type === 'dates' ? draft.row.name : 'Напоминания в VK'}</DialogTitle><DialogContent>
      {dialogError && <Alert severity='error' sx={{ mb: 2 }}>{dialogError}</Alert>}
      <Box display='grid' gap={2} pt={1}>{draft.type === 'dates' ? <>
        <TextField label='Дата рождения' type='date' disabled={busy} InputLabelProps={{ shrink: true }} value={draft.birth_date} onChange={e => setDraft({ ...draft, birth_date: e.target.value })} />
        <TextField label='Медосмотр действителен до' type='date' disabled={busy} InputLabelProps={{ shrink: true }} value={draft.medical_until} onChange={e => setDraft({ ...draft, medical_until: e.target.value })} />
      </> : <>
        <Box>{draft.row.profile_url}</Box>
        <FormControlLabel label='Получать напоминания о медосмотрах сотрудников' control={<Checkbox disabled={busy} checked={draft.medical} onChange={e => setDraft({ ...draft, medical: e.target.checked })} />} />
        <FormControlLabel label='Получать напоминания о днях рождения сотрудников' control={<Checkbox disabled={busy} checked={draft.birthdays} onChange={e => setDraft({ ...draft, birthdays: e.target.checked })} />} />
        {!draft.row.enabled && <Alert severity='warning'>Общая доставка этому получателю выключена. Включите её в настройках VK.</Alert>}
      </>}</Box>
    </DialogContent><DialogActions><Button disabled={busy} onClick={close}>Отмена</Button><Button disabled={busy} variant='contained' onClick={save}>Сохранить</Button></DialogActions></Dialog>}
  </div></main>;
}
