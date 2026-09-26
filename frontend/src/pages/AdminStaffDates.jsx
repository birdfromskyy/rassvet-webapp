import './AdminModule.scss';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Switch, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField } from '@mui/material';
import { ArrowBack, Edit, Search as SearchIcon } from '@mui/icons-material';
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
  const [reminderTimes, setReminderTimes] = useState({ birthdays: '11:00', medical: '11:05' });
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    Promise.all([service.list(controller.signal), service.recipients(controller.signal)]).then(([data, recipients]) => {
      if (controller.signal.aborted) return;
      setRows(data.staff); setReminderTimes(data.reminder_times || { birthdays: '11:00', medical: '11:05' }); setRecipients(recipients);
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
  const upcomingMedical = rows.filter(row => row.active && row.medical_days != null && row.medical_days <= 20).length;
  const upcomingBirthdays = rows.filter(row => row.active && row.birthday_days != null && row.birthday_days <= 2).length;
  return <main className='admin-module admin-staff-dates'><div className='admin-module__container'>
    <section className='admin-module__hero'><div><span className='admin-module__badge'>Настройки системы</span><h1>Даты сотрудников</h1><p>Контролируйте медосмотры и дни рождения сотрудников.</p></div><div className='admin-module__actions'><Button className='admin-module__button admin-module__button--ghost' startIcon={<ArrowBack />} onClick={() => navigate('/admin/cms')}>Назад</Button><Button className='admin-module__button admin-module__button--ghost' onClick={() => navigate('/admin/cms/vk-notifications')}>Получатели VK</Button><Button className='admin-module__button admin-module__button--primary' onClick={() => setReload(n => n + 1)}>Обновить</Button></div></section>
    <div className='admin-users-stats'>
      <div className='admin-users-stat'><span>Сотрудников в списке</span><strong>{rows.length}</strong></div>
      <div className='admin-users-stat'><span>Медосмотры требуют внимания</span><strong>{upcomingMedical}</strong></div>
      <div className='admin-users-stat'><span>Дни рождения в ближайшие 2 дня</span><strong>{upcomingBirthdays}</strong></div>
    </div>
    <section className='admin-module__panel'>
      <Tabs className='admin-staff-dates__tabs' value={tab} onChange={(_, value) => setTab(value)} variant='scrollable' allowScrollButtonsMobile sx={{ mb: 3 }}><Tab label='Медосмотры' /><Tab label='Дни рождения' /></Tabs>
      {error && <Alert severity='error' action={<Button onClick={() => setReload(n => n + 1)}>Повторить</Button>}>{error}</Alert>}
      {loading && <CircularProgress aria-label='Загрузка сотрудников' />}
      {!loading && !error && (tab === 2 ? <>
        <Alert severity='info' sx={{ mb: 2 }}>Дни рождения: в {reminderTimes.birthdays}, за 2 дня. Медосмотры: в {reminderTimes.medical}, за 20 дней и в день окончания. Время центра — UTC+5.</Alert>
        <Button variant='outlined' sx={{ mb: 2 }} onClick={() => navigate('/admin/cms/vk-notifications')}>Добавить или настроить страницу VK</Button>
        {recipients.length ? <div className='admin-vk-list'>
          {recipients.map(row => <article className='admin-vk-recipient admin-staff-vk-recipient' key={row.id}>
            <div className='admin-vk-recipient__identity'><span className='admin-vk-recipient__avatar'>VK</span><div><strong>{row.profile_url}</strong><span>{row.enabled ? 'Доставка включена' : 'Доставка отключена'}</span></div></div>
            <Chip label={row.enabled ? 'Доставка включена' : 'Доставка отключена'} color={row.enabled ? 'success' : 'default'} />
            <div className='admin-staff-vk-recipient__preferences'><span>Медосмотры: <b>{row.medical ? 'включены' : 'выключены'}</b></span><span>Дни рождения: <b>{row.birthdays ? 'включены' : 'выключены'}</b></span></div>
            <Button variant='outlined' startIcon={<Edit />} onClick={() => { setDialogError(''); setDraft({ type: 'recipient', row, medical: row.medical, birthdays: row.birthdays }); }}>Настроить</Button>
          </article>)}
        </div> : <div className='admin-vk-empty'><h2>Получателей пока нет</h2><p>Добавьте страницу VK, чтобы включить персональные напоминания для неё.</p></div>}
      </> : <>
        <Box className='admin-staff-dates__filters' display='flex' gap={2} flexWrap='wrap' mb={2}>
          <div className='admin-module__search admin-staff-dates__search'><SearchIcon /><input aria-label='Поиск по ФИО' placeholder='Поиск по ФИО...' value={query} onChange={e => setQuery(e.target.value)} /></div>
          <TextField select label='Должность' value={role} onChange={e => setRole(e.target.value)} sx={{ minWidth: 180 }}><MenuItem value='all'>Все</MenuItem>{Object.entries(roles).map(([id, title]) => <MenuItem key={id} value={id}>{title}</MenuItem>)}</TextField>
          <TextField select label='Сортировка' value={direction} onChange={e => setDirection(Number(e.target.value))} sx={{ minWidth: 180 }}><MenuItem value={1}>Сначала ближайшие</MenuItem><MenuItem value={-1}>Сначала дальние</MenuItem></TextField>
        </Box>
        <Box className='admin-staff-dates__filters-row' display='flex' justifyContent='space-between' flexWrap='wrap' mb={2}><FormControlLabel label='Показывать неактивных' control={<Checkbox checked={inactive} onChange={e => setInactive(e.target.checked)} />} /><Button onClick={() => setReload(n => n + 1)}>Обновить список</Button></Box>
        <TableContainer><Table><TableHead><TableRow><TableCell>Сотрудник</TableCell><TableCell>Должность</TableCell><TableCell>{tab === 0 ? 'Медосмотр до' : 'Дата рождения'}</TableCell><TableCell>{tab === 0 ? 'Срок' : 'Ближайший день рождения'}</TableCell><TableCell /></TableRow></TableHead><TableBody>
          {visible.map(row => { const days = tab === 0 ? row.medical_days : row.birthday_days; return <TableRow key={`${row.kind}/${row.owner_id}`}><TableCell>{row.name}{!row.active && <Chip size='small' label='Неактивен' sx={{ ml: 1 }} />}</TableCell><TableCell>{roles[row.role]}</TableCell><TableCell>{dateLabel(tab === 0 ? row.dates.medical_until : row.dates.birth_date)}</TableCell><TableCell>{days == null ? '—' : <Chip size='small' color={days < 0 ? 'error' : days <= (tab === 0 ? 20 : 2) ? 'warning' : 'success'} label={days < 0 ? `Просрочен на ${-days} дн.` : days === 0 ? 'Сегодня' : `Через ${days} дн.${tab === 1 ? ` · ${dateLabel(row.next_birthday)}` : ''}`} />}</TableCell><TableCell><Button variant='outlined' startIcon={<Edit />} onClick={() => { setDialogError(''); setDraft({ type: 'dates', row, birth_date: dateInputValue(row.dates.birth_date), medical_until: dateInputValue(row.dates.medical_until) }); }}>Изменить</Button></TableCell></TableRow>; })}
          {!visible.length && <TableRow><TableCell colSpan={5}>Сотрудники не найдены</TableCell></TableRow>}
        </TableBody></Table></TableContainer>
        {tab === 1 && <Box component='p' sx={{ color: 'text.secondary', fontSize: 13 }}>Для 29 февраля в невисокосный год используется 28 февраля.</Box>}
      </>)}
    </section>
    {draft && <Dialog open onClose={close} fullWidth maxWidth='sm' PaperProps={{ className: 'admin-module-dialog' }}><DialogTitle className='admin-module-dialog__title'>{draft.type === 'dates' ? draft.row.name : 'Напоминания в VK'}</DialogTitle><DialogContent dividers className='admin-module-dialog__content'>
      {dialogError && <Alert severity='error' sx={{ mb: 2 }}>{dialogError}</Alert>}
      <Box display='grid' gap={2} pt={1}>{draft.type === 'dates' ? <>
        <TextField label='Дата рождения' type='date' disabled={busy} InputLabelProps={{ shrink: true }} value={draft.birth_date} onChange={e => setDraft({ ...draft, birth_date: e.target.value })} />
        <TextField label='Медосмотр действителен до' type='date' disabled={busy} InputLabelProps={{ shrink: true }} value={draft.medical_until} onChange={e => setDraft({ ...draft, medical_until: e.target.value })} />
      </> : <>
        <Box>{draft.row.profile_url}</Box>
        <FormControlLabel label='Получать напоминания о медосмотрах сотрудников' control={<Switch disabled={busy} checked={Boolean(draft.medical)} onChange={e => setDraft({ ...draft, medical: e.target.checked })} />} />
        <FormControlLabel label='Получать напоминания о днях рождения сотрудников' control={<Switch disabled={busy} checked={Boolean(draft.birthdays)} onChange={e => setDraft({ ...draft, birthdays: e.target.checked })} />} />
        {!draft.row.enabled && <Alert severity='warning'>Общая доставка этому получателю выключена. Включите её в настройках VK.</Alert>}
      </>}</Box>
    </DialogContent><DialogActions className='admin-module-dialog__actions'><Button disabled={busy} onClick={close}>Отмена</Button><Button disabled={busy} variant='contained' onClick={save}>Сохранить</Button></DialogActions></Dialog>}
  </div></main>;
}
