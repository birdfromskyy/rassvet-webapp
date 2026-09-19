import React, { useMemo, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import reporting from '../../services/monthlyReportingService';
import { errorText, personBody, personName } from './model';

export function PersonFields({ value, onChange, disabled }) {
  return <Box className='monthly-services__fields'>
    {[['last_name', 'Фамилия'], ['first_name', 'Имя'], ['middle_name', 'Отчество']].map(([key, label]) => <TextField key={key} label={label} required={key !== 'middle_name'} inputProps={{ maxLength: 80 }} disabled={disabled} value={value[key] || ''} onChange={e => onChange({ ...value, [key]: e.target.value })} />)}
    <TextField label='Дата рождения' type='date' disabled={disabled} InputLabelProps={{ shrink: true }} value={value.birth_date || ''} onChange={e => onChange({ ...value, birth_date: e.target.value })} />
  </Box>;
}

export default function PeopleDialog({ student, representatives, links, onClose, onSaved }) {
  const linked = useMemo(() => representatives.filter(rep => links.some(link => link.legal_representative_id === rep.id)), [representatives, links]);
  const [child, setChild] = useState(student);
  const [rep, setRep] = useState(linked[0] || null);
  const [childDirty, setChildDirty] = useState(false);
  const [repDirty, setRepDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true); setError('');
    try {
      let savedChild = child;
      let savedRep = rep;
      if (childDirty) savedChild = await reporting.identity(student.id, personBody(child));
      if (repDirty && rep) savedRep = await reporting.saveRepresentative(rep.id, { ...personBody(rep), user_id: rep.user_id, is_active: rep.is_active ?? true });
      const nextReps = savedRep ? representatives.map(row => row.id === savedRep.id ? savedRep : row) : representatives;
      onSaved({ student: savedChild, representatives: nextReps, links });
      onClose();
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };

  return <Dialog open onClose={() => !busy && onClose()} fullWidth maxWidth='md'>
    <DialogTitle>Карточка ребёнка и родителей</DialogTitle>
    <DialogContent>
      {error && <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert>}
      <Typography variant='h6' mb={2}>Ребёнок</Typography>
      <PersonFields value={child} disabled={busy} onChange={value => { setChild(value); setChildDirty(true); }} />
      <Typography variant='h6' mt={3} mb={1}>Родитель</Typography>
      {linked.length ? <>
        <Autocomplete disabled={busy || repDirty} options={linked} value={rep} isOptionEqualToValue={(a, b) => a.id === b.id} getOptionLabel={personName} onChange={(_, value) => { setRep(value); setRepDirty(false); }} renderInput={params => <TextField {...params} label='Родитель, привязанный к ребёнку' helperText={repDirty ? 'Сохраните или отмените изменения перед выбором другого родителя' : ''} />} />
        {rep && <Box mt={2}><PersonFields value={rep} disabled={busy} onChange={value => { setRep(value); setRepDirty(true); }} /></Box>}
      </> : <Alert severity='info'>У ребёнка нет привязанного родителя. Связь добавляется в разделе пользователей.</Alert>}
    </DialogContent>
    <DialogActions>
      <Button disabled={busy} onClick={onClose}>Отмена</Button>
      <Button disabled={busy || (!childDirty && !repDirty)} variant='contained' onClick={save}>Сохранить</Button>
    </DialogActions>
  </Dialog>;
}
