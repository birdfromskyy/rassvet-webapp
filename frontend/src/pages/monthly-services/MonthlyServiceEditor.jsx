import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material';
import reporting from '../../services/monthlyReportingService';
import ServicePicker from './ServicePicker';
import PeopleDialog from './PeopleDialog';
import { createRequestId, editRow, errorText, frequencyMaximum, groups, itemBody, matches, maximum, monthLabel, newRow, personName, previousMonth, representativeAvailable, rubles, totals } from './model';

export default function MonthlyServiceEditor({ studentId, month, directory, onStateChange, onPersonSaved }) {
  const [data, setData] = useState(null);
  const [rows, setRows] = useState([]);
  const [representative, setRepresentative] = useState('');
  const [refreshSnapshots, setRefreshSnapshots] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState(null);
  const [manualMaximums, setManualMaximums] = useState({});
  const [reload, setReload] = useState(0);
  const generation = useRef(0);
  const request = useRef(null);
  const mutation = useRef(false);
  const key = `${studentId}/${month}`;
  const loaded = !loading && data?.key === key;
  const saved = loaded ? data.month : null;
  const finalized = saved?.status === 'finalized';
  const locked = busy || !loaded || finalized || conflict;
  const accept = useCallback(value => {
    setRows((value?.items || []).map(editRow));
    setRepresentative(value?.representative_id ?? '');
    setDirty(false); setRefreshSnapshots(false); setConflict(false);
  }, []);

  useEffect(() => {
    const id = ++generation.current;
    const controller = new AbortController();
    setLoading(true); setData(null); setError(''); setNotice(''); setDialog(null); setQuery(''); setDirty(false); setConflict(false);
    request.current = null;
    Promise.all([
      reporting.month(studentId, month, controller.signal), reporting.student(studentId, controller.signal),
      reporting.representatives(controller.signal), reporting.links(studentId, controller.signal), reporting.legacy(studentId, controller.signal),
    ]).then(([value, student, representatives, links, legacy]) => {
      if (id !== generation.current) return;
      setData({ key, month: value, student, representatives, links, legacy }); accept(value);
    }).catch(e => { if (id === generation.current && !controller.signal.aborted) setError(errorText(e)); })
      .finally(() => { if (id === generation.current) setLoading(false); });
    return () => { generation.current = id + 1; controller.abort(); };
  }, [studentId, month, key, reload, accept]);

  useEffect(() => { onStateChange({ dirty, busy: busy || Boolean(dialog), loading }); }, [dirty, busy, dialog, loading, onStateChange]);
  useEffect(() => {
    const warn = e => { if (dirty || busy || dialog) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy, dialog]);

  const mutate = async operation => {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setError(''); setNotice('');
    const current = generation.current;
    try {
      const result = await operation();
      if (current !== generation.current) return;
      setData(value => ({ ...value, month: result, legacy: [] })); accept(result); setDialog(null); setNotice('Сохранено');
    } catch (e) {
      if (current !== generation.current) return;
      setConflict(e.response?.status === 409);
      setError(e.response?.status === 404 ? 'За предыдущий календарный месяц нет сохранённого набора.' : errorText(e));
    } finally { mutation.current = false; if (current === generation.current) setBusy(false); }
  };
  const create = async body => {
    const signature = JSON.stringify({ key, body });
    if (request.current?.signature !== signature) request.current = { signature, id: createRequestId() };
    const result = await reporting.create(studentId, month, { ...body, request_id: request.current.id });
    // An idempotent retry returns creation revision, not necessarily the latest.
    // Keep the form on screen if this read fails; retry uses the same key.
    return await reporting.month(studentId, month) || result;
  };
  const save = () => {
    let items;
    try { items = rows.map(row => { try { return itemBody(row); } catch (e) { throw new Error(`${row.name}: ${e.message}`); } }); }
    catch (e) { setError(e.message); return; }
    const body = { representative_id: representative === '' ? null : Number(representative), items };
    mutate(() => saved ? reporting.save(studentId, month, { ...body, revision: saved.revision, refresh_snapshots: refreshSnapshots }) : create({ ...body, mode: 'create' }));
  };
  const copy = () => mutate(() => saved
    ? reporting.transition(studentId, month, 'copy-previous', saved.revision)
    : create({ mode: 'copy_previous', representative_id: representative === '' ? null : Number(representative) }));
  const migrate = () => {
    const legacyMaximums = {};
    try {
      data.legacy.filter(row => frequencyMaximum(row.periodicity) === null).forEach(row => {
        const max = String(manualMaximums[row.social_service_id] ?? '');
        if (!/^\d+$/.test(max) || Number(max) > 100000) throw new Error('Укажите максимум каждой услуги с нестандартной периодичностью');
        legacyMaximums[row.social_service_id] = Number(max);
      });
    } catch (e) { setError(e.message); return; }
    mutate(() => create({ mode: 'migrate_legacy', representative_id: representative === '' ? null : Number(representative), legacy_maximums: legacyMaximums }));
  };
  const update = (id, field, value) => {
    setRows(current => current.map(row => row.social_service_id === id ? { ...row, [field]: value, ...(field === 'periodicity' ? { maximum_monthly_count: frequencyMaximum(value) ?? '' } : {}) } : row));
    setDirty(true); setNotice('');
  };
  const reloadData = () => {
    if ((dirty || conflict) && !window.confirm('Загрузить сохранённые данные? Несохранённый ввод на экране будет потерян.')) return;
    setReload(n => n + 1);
  };
  const summary = totals(rows);
  const identity = refreshSnapshots || !saved ? data?.student : saved.snapshot.student;
  const identityMissing = !identity?.last_name || !identity?.first_name || !identity?.birth_date;
  const reps = loaded ? [...data.representatives] : [];
  const snapshotRep = saved?.snapshot?.representative;
  if (snapshotRep && !reps.some(row => row.id === snapshotRep.id)) reps.push({ ...snapshotRep, is_active: false });
  const legacy = loaded && !saved && data.legacy.length > 0;

  if (loading) return <Box py={5} textAlign='center'><CircularProgress aria-label='Загрузка месяца' /></Box>;
  if (!loaded) return <Alert severity='error' action={<Button onClick={reloadData}>Повторить</Button>}>{error || 'Не удалось загрузить месяц'}</Alert>;
  return <Box className='monthly-services'>
    <div className='monthly-services__toolbar'>
      <Chip label={saved ? (finalized ? 'Месяц зафиксирован' : 'Черновик') : 'Новый месяц'} color={finalized ? 'success' : 'default'} />
      {dirty && <Chip label='Есть несохранённые изменения' color='warning' variant='outlined' />}
      <Button disabled={busy} onClick={() => setDialog('people')}>Ребёнок и представители</Button>
      <Button disabled={busy} onClick={reloadData}>Обновить данные</Button>
    </div>
    {error && <Alert severity='error' sx={{ my: 2 }}>{error}{conflict && <Button onClick={reloadData}>Загрузить актуальные данные</Button>}</Alert>}
    {notice && <Alert severity='success' sx={{ my: 2 }}>{notice}</Alert>}
    {identityMissing && <Alert severity='warning' sx={{ my: 2 }}>Для фиксации месяца заполните фамилию, имя и дату рождения ребёнка.{saved && <Button disabled={locked} onClick={() => { setRefreshSnapshots(true); setDirty(true); }}>Обновить сведения месяца из карточки</Button>}</Alert>}
    <div className='monthly-services__toolbar'>
      <TextField select label='Законный представитель' value={representative} disabled={locked} onChange={e => { setRepresentative(e.target.value); setDirty(true); }} sx={{ minWidth: { xs: 0, sm: 260 }, flex: 1 }}>
        <MenuItem value=''>Не выбран</MenuItem>
        {reps.filter(rep => data.links.some(link => link.legal_representative_id === rep.id) || rep.id === Number(representative)).map(rep => {
          const available = representativeAvailable(rep, data.links.find(link => link.legal_representative_id === rep.id), month);
          const display = rep.id === saved?.representative_id && snapshotRep && !refreshSnapshots ? snapshotRep : rep;
          return <MenuItem key={rep.id} value={rep.id} disabled={!available && rep.id !== Number(representative)}>{personName(display)}{available ? '' : ' — архив / не действует в этом месяце'}</MenuItem>;
        })}
      </TextField>
      {saved && !finalized && <Button disabled={locked} onClick={() => { setRefreshSnapshots(true); setDirty(true); }}>{refreshSnapshots ? 'Сведения обновятся при сохранении' : 'Обновить сведения месяца из карточек'}</Button>}
    </div>
    {representative === '' && <Typography variant='body2' sx={{ mt: 1, mb: 2 }}>Представитель не выбран. Это не мешает сохранить и зафиксировать услуги.</Typography>}
    {saved && <Box component='details' sx={{ my: 2 }}>
      <summary>Сохранённые сведения для документов</summary>
      <Typography variant='body2'>{personName(saved.snapshot.student)} · {saved.snapshot.student.birth_date || 'Дата рождения не заполнена'}</Typography>
      <Typography variant='body2'>{snapshotRep ? `Представитель: ${personName(snapshotRep)}` : 'Представитель не выбран'}</Typography>
      <Typography variant='body2'>Договор: {saved.snapshot.contract?.contract_number || '—'} · {saved.snapshot.contract?.contract_date || '—'}</Typography>
    </Box>}
    {legacy ? <Alert severity='info' sx={{ my: 3 }}>
      Есть услуги без привязки к месяцу. Перенести их в {monthLabel(month)}?
      <Box><Button disabled={locked} variant='outlined' onClick={() => setDialog('migrate')}>Перенести текущие назначения</Button></Box>
    </Alert> : <>
      <div className='monthly-services__toolbar'>
        <TextField label='Поиск по выбранным услугам' value={query} onChange={e => setQuery(e.target.value)} sx={{ flex: 1 }} />
        <Button variant='outlined' disabled={locked} onClick={() => setDialog('copy')}>Скопировать предыдущий месяц</Button>
        <Button variant='outlined' disabled={locked} onClick={() => setDialog('picker')}>Выбрать услуги</Button>
      </div>
      {!rows.length && <Typography sx={{ py: 4 }}>В этом месяце услуги ещё не выбраны.</Typography>}
      {!!rows.length && !rows.some(row => matches(row, query)) && <Typography sx={{ py: 3 }}>Услуги не найдены.</Typography>}
      {groups(rows.filter(row => matches(row, query))).map(([category, services]) => <section key={category} className='monthly-services__category'>
        <h2>{category}</h2>
        {services.map(row => {
          let validation = '';
          try { itemBody(row); } catch (e) { validation = e.message; }
          const total = totals([row]);
          const archived = !directory.find(item => item.id === row.social_service_id)?.is_active;
          return <article key={row.social_service_id} className='monthly-services__row'>
            <div><Typography component='h3' fontWeight={600}>{row.name}</Typography><Typography variant='caption'>Код: {row.code}{archived ? ' · Архивная услуга' : ''}</Typography></div>
            <div className='monthly-services__row-fields'>
              <TextField label='Периодичность' disabled={locked} value={row.periodicity} inputProps={{ maxLength: 255, 'aria-label': `Периодичность: ${row.name}` }} onChange={e => update(row.social_service_id, 'periodicity', e.target.value)} />
              <TextField label='Максимум' type='number' disabled={locked} value={maximum(row)} InputProps={{ readOnly: frequencyMaximum(row.periodicity) !== null }} inputProps={{ min: 0, max: 100000, 'aria-label': `Максимум: ${row.name}` }} onChange={e => update(row.social_service_id, 'maximum_monthly_count', e.target.value)} />
              <TextField label='Факт, услуг' type='number' disabled={locked} value={row.actual_monthly_count} placeholder='—' InputLabelProps={{ shrink: true }} color={row.actual_monthly_count === '' ? 'warning' : 'primary'} helperText={row.actual_monthly_count === '' ? 'Не заполнено' : Number(row.actual_monthly_count) === 0 ? 'Подтверждено: 0' : 'Указано'} inputProps={{ min: 0, max: maximum(row), 'aria-label': `Фактически: ${row.name}` }} onChange={e => update(row.social_service_id, 'actual_monthly_count', e.target.value)} />
              <TextField label='Стандарт, мин.' type='number' disabled={locked} value={row.standard_duration_minutes} inputProps={{ min: 1, max: 1440, 'aria-label': `Стандарт: ${row.name}` }} onChange={e => update(row.social_service_id, 'standard_duration_minutes', e.target.value)} />
              <TextField label='Тариф, ₽' disabled={locked} value={row.tariff_rub} inputProps={{ inputMode: 'decimal', 'aria-label': `Тариф: ${row.name}` }} onChange={e => update(row.social_service_id, 'tariff_rub', e.target.value)} />
              <Typography className='monthly-services__amount'>{row.actual_monthly_count === '' || validation ? '— мин. · — ₽' : `${total.minutes} мин. · ${rubles(total.kopecks)} ₽`}</Typography>
            </div>
            {validation && <Typography color='error' variant='body2'>{validation}</Typography>}
          </article>;
        })}
      </section>)}
      <div className='monthly-services__summary'>
        <Typography fontWeight={600}>Итого: {summary.services} услуг · {summary.minutes} мин. · {rubles(summary.kopecks)} ₽</Typography>
        {(summary.unfilled > 0 || summary.invalid > 0) && <Typography variant='body2'>Не заполнено: {summary.unfilled} · С ошибками: {summary.invalid}</Typography>}
        <div className='monthly-services__toolbar'>
          {!finalized && <Button className='admin-module__button admin-module__button--primary' disabled={locked || (!dirty && !!saved)} onClick={save}>{busy ? 'Сохранение…' : 'Сохранить месяц'}</Button>}
          {!finalized && <Button variant='outlined' disabled={locked || !saved || dirty || !rows.length || summary.unfilled > 0 || summary.invalid > 0 || identityMissing} onClick={() => setDialog('finalize')}>Зафиксировать месяц</Button>}
          {finalized && <Button variant='outlined' disabled={busy || conflict} onClick={() => setDialog('reopen')}>Открыть для изменений</Button>}
        </div>
      </div>
    </>}
    {dialog === 'picker' && <ServicePicker directory={directory} rows={rows} onClose={() => setDialog(null)} onApply={ids => {
      const existing = new Map(rows.map(row => [row.social_service_id, row]));
      const chosen = ids.map(id => existing.get(id) || newRow(directory.find(row => row.id === id)));
      setRows(chosen); setDirty(true); setDialog(null);
    }} />}
    {dialog === 'people' && <PeopleDialog student={data.student} representatives={data.representatives} links={data.links} onClose={() => setDialog(null)} onSaved={people => { setData(value => ({ ...value, ...people })); onPersonSaved(people.student); setNotice(saved ? 'Карточки сохранены. Сведения уже созданного месяца обновляются отдельно.' : 'Карточки сохранены.'); }} />}
    {['copy', 'migrate', 'finalize', 'reopen'].includes(dialog) && <Dialog open onClose={() => { if (!busy) setDialog(null); }} fullWidth maxWidth='sm'>
      <DialogTitle>{dialog === 'copy' ? 'Копирование назначений' : dialog === 'migrate' ? 'Перенос в месячный учёт' : dialog === 'finalize' ? 'Зафиксировать месяц?' : 'Открыть месяц для изменений?'}</DialogTitle>
      <DialogContent>
        <Typography>{monthLabel(month)} · {data.student.full_name}</Typography>
        {dialog === 'copy' && <Typography mt={2}>Назначения за {monthLabel(previousMonth(month))} заменят текущий список и введённые количества. Фактические количества будут пустыми. Представитель сохранённого месяца останется прежним.</Typography>}
        {dialog === 'migrate' && <><Typography mt={2}>Текущие назначения будут привязаны только к этому месяцу. Фактические количества нужно заполнить заново. Старый набор останется в архиве.</Typography>{data.legacy.filter(row => frequencyMaximum(row.periodicity) === null).map(row => <TextField fullWidth margin='normal' key={row.social_service_id} label={`Максимум: ${row.social_service?.name || row.periodicity}`} helperText={row.periodicity} type='number' value={manualMaximums[row.social_service_id] ?? ''} onChange={e => setManualMaximums({ ...manualMaximums, [row.social_service_id]: e.target.value })} />)}</>}
        {dialog === 'finalize' && <Typography mt={2}>Сохранённые услуги и количества будут зафиксированы. Позже можно открыть новую редакцию.</Typography>}
        {dialog === 'reopen' && <Typography mt={2}>Предыдущая редакция сохранится в истории.</Typography>}
        {error && <Alert severity='error' sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions><Button disabled={busy} onClick={() => setDialog(null)}>Отмена</Button><Button disabled={busy || conflict} variant='contained' onClick={() => dialog === 'copy' ? copy() : dialog === 'migrate' ? migrate() : mutate(() => reporting.transition(studentId, month, dialog, saved.revision))}>Подтвердить</Button></DialogActions>
    </Dialog>}
  </Box>;
}
