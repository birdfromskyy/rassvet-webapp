import React, { useState } from 'react';
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material';
import reporting from '../../services/monthlyReportingService';
import { errorText, personBody, personName } from './model';

export function PersonFields({ value, onChange, disabled }) {
  return <Box className='monthly-services__fields'>
    {[['last_name', 'Фамилия'], ['first_name', 'Имя'], ['middle_name', 'Отчество']].map(([key, label]) => <TextField key={key} label={label} required={key !== 'middle_name'} inputProps={{ maxLength: 80 }} disabled={disabled} value={value[key] || ''} onChange={e => onChange({ ...value, [key]: e.target.value })} />)}
    <TextField label='Дата рождения' type='date' disabled={disabled} InputLabelProps={{ shrink: true }} value={value.birth_date || ''} onChange={e => onChange({ ...value, birth_date: e.target.value })} />
  </Box>;
}

export default function PeopleDialog({ student, representatives, links, onClose, onSaved }) {
  const [child, setChild] = useState(student);
  const [savedChild, setSavedChild] = useState(student);
  const [reps, setReps] = useState(representatives);
  const [relations, setRelations] = useState(links);
  const [rep, setRep] = useState(null);
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [childDirty, setChildDirty] = useState(false);
  const [dirty, setDirty] = useState(false);
  const close = () => { if (!busy && (!(dirty || childDirty) || window.confirm('Закрыть без сохранения изменений в карточке?'))) onClose(); };
  const execute = async task => {
    setBusy(true); setError(''); setMessage('');
    try { await task(); setMessage('Сохранено'); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };
  const select = value => {
    if (dirty && !window.confirm('Отменить несохранённые изменения карточки?')) return;
    setRep(value);
    setLink(value ? relations.find(row => row.legal_representative_id === value.id) || { revision: 0, relationship: '', valid_from: null, valid_until: null } : null);
    setDirty(false); setError('');
  };
  const saveChild = () => execute(async () => {
    const saved = await reporting.identity(student.id, personBody(child));
    setChild(saved);
    setSavedChild(saved); setChildDirty(false);
    onSaved({ student: saved, representatives: reps, links: relations });
  });
  const saveRep = () => execute(async () => {
    // Keep the successful representative after a failed link save, so retry
    // never creates a second person and uses the latest returned revision.
    const saved = await reporting.saveRepresentative(rep.id, { ...personBody(rep), user_id: rep.user_id ?? null, is_active: rep.is_active ?? true });
    setRep(saved);
    const nextReps = [...reps.filter(row => row.id !== saved.id), saved];
    setReps(nextReps);
    onSaved({ student: savedChild, representatives: nextReps, links: relations });
    const savedLink = await reporting.saveLink(student.id, saved.id, { revision: link.revision, relationship: link.relationship, valid_from: link.valid_from || null, valid_until: link.valid_until || null });
    setLink(savedLink);
    const nextLinks = [...relations.filter(row => row.legal_representative_id !== saved.id), savedLink];
    setRelations(nextLinks);
    onSaved({ student: savedChild, representatives: nextReps, links: nextLinks });
    setDirty(false);
  });
  const reload = () => {
    if ((dirty || childDirty) && !window.confirm('Загрузить актуальные карточки вместо введённых значений?')) return;
    execute(async () => {
      const [freshChild, freshReps, freshLinks] = await Promise.all([reporting.student(student.id), reporting.representatives(), reporting.links(student.id)]);
      setChild(freshChild); setSavedChild(freshChild); setReps(freshReps); setRelations(freshLinks);
      const freshRep = freshReps.find(row => row.id === rep?.id) || null;
      setRep(freshRep); setLink(freshRep ? freshLinks.find(row => row.legal_representative_id === freshRep.id) || { revision: 0, relationship: '', valid_from: null, valid_until: null } : null);
      setDirty(false); setChildDirty(false);
      onSaved({ student: freshChild, representatives: freshReps, links: freshLinks });
    });
  };
  return <Dialog open onClose={close} fullWidth maxWidth='md'>
    <DialogTitle>Ребёнок и представители</DialogTitle>
    <DialogContent>
      {error && <Alert severity='error' sx={{ mb: 2 }}>{error}<Button disabled={busy} onClick={reload}>Загрузить актуальные карточки</Button></Alert>}
      {message && <Alert severity='success' sx={{ mb: 2 }}>{message}</Alert>}
      <Typography variant='h6' mb={2}>{student.full_name}</Typography>
      <PersonFields value={child} disabled={busy} onChange={value => { setChild(value); setChildDirty(true); }} />
      <Button disabled={busy} sx={{ my: 2 }} variant='outlined' onClick={saveChild}>Сохранить ребёнка</Button>
      <Typography variant='h6' mb={2}>Законные представители</Typography>
      <Autocomplete disabled={busy} options={reps} value={rep?.id ? reps.find(row => row.id === rep.id) || null : null} isOptionEqualToValue={(a, b) => a.id === b.id} getOptionLabel={row => `${personName(row)}${row.is_active ? '' : ' (архив)'}`} onChange={(_, value) => select(value)} renderInput={params => <TextField {...params} label='Найти существующего представителя' />} />
      <Button disabled={busy} sx={{ my: 2 }} onClick={() => select({ last_name: '', first_name: '', middle_name: '', birth_date: null, is_active: true })}>Новый представитель</Button>
      {rep && <>
        <PersonFields value={rep} disabled={busy} onChange={value => { setRep(value); setDirty(true); }} />
        <Box className='monthly-services__fields' mt={2}>
          <TextField required label='Кем приходится ребёнку' disabled={busy} value={link?.relationship || ''} onChange={e => { setLink({ ...link, relationship: e.target.value }); setDirty(true); }} />
          <TextField select label='Состояние представителя' disabled={busy} value={rep.is_active ? 'active' : 'inactive'} onChange={e => { setRep({ ...rep, is_active: e.target.value === 'active' }); setDirty(true); }}><MenuItem value='active'>Активен</MenuItem><MenuItem value='inactive'>Архив</MenuItem></TextField>
          {[['valid_from', 'Начало полномочий'], ['valid_until', 'Окончание полномочий']].map(([key, label]) => <TextField key={key} label={label} type='date' disabled={busy} InputLabelProps={{ shrink: true }} value={link?.[key] || ''} onChange={e => { setLink({ ...link, [key]: e.target.value }); setDirty(true); }} />)}
        </Box>
        <Button variant='outlined' sx={{ my: 2 }} disabled={busy || !link?.relationship.trim()} onClick={saveRep}>Сохранить представителя и связь</Button>
      </>}
      {relations.length > 0 && <Box mt={2}>{relations.map(row => <Typography key={row.id}>{personName(reps.find(r => r.id === row.legal_representative_id))} — {row.relationship}{row.valid_until ? `, до ${row.valid_until}` : ''}</Typography>)}</Box>}
    </DialogContent>
    <DialogActions><Button disabled={busy} onClick={close}>Закрыть</Button></DialogActions>
  </Dialog>;
}
