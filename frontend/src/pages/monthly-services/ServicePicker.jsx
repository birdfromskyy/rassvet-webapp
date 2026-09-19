import React, { useState } from 'react';
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, TextField, Typography } from '@mui/material';
import { groups, matches } from './model';

export default function ServicePicker({ directory, rows, onApply, onClose }) {
  const [ids, setIDs] = useState(rows.map(row => row.social_service_id));
  const [query, setQuery] = useState('');
  // Selected historical services remain removable even if archived or absent
  // from the live directory. Their monthly snapshots are not overwritten.
  const choices = [...new Map([...directory.filter(row => row.is_active), ...rows.map(row => ({ ...row, id: row.social_service_id }))].map(row => [row.id, row])).values()];
  const visible = choices.filter(row => matches(row, query));
  const toggle = (list, checked) => setIDs(current => checked ? [...new Set([...current, ...list])] : current.filter(id => !list.includes(id)));
  return <Dialog open onClose={onClose} fullWidth maxWidth='md'>
    <DialogTitle>Услуги по ИППСУ</DialogTitle>
    <DialogContent>
      <TextField autoFocus fullWidth label='Поиск услуг' value={query} onChange={e => setQuery(e.target.value)} margin='normal' />
      <Button onClick={() => toggle(visible.map(row => row.id), true)}>Выбрать {query ? 'найденные' : 'все'}</Button>
      <Button onClick={() => toggle(visible.map(row => row.id), false)}>Снять {query ? 'найденные' : 'все'}</Button>
      {!visible.length && <Typography>Услуги не найдены</Typography>}
      {groups(visible).map(([category, services]) => {
        const list = services.map(row => row.id);
        const count = list.filter(id => ids.includes(id)).length;
        return <Box key={category} my={2}>
          <FormControlLabel label={<strong>{category}</strong>} control={<Checkbox checked={count === list.length} indeterminate={count > 0 && count < list.length} onChange={e => toggle(list, e.target.checked)} />} />
          <Box pl={2}>{services.map(row => <FormControlLabel key={row.id} sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }} label={`${row.code} — ${row.name}${directory.find(d => d.id === row.id)?.is_active ? '' : ' (архив)'}`} control={<Checkbox checked={ids.includes(row.id)} onChange={e => toggle([row.id], e.target.checked)} />} />)}</Box>
        </Box>;
      })}
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Отмена</Button><Button variant='contained' onClick={() => onApply(ids)}>Сохранить услуги ({ids.length})</Button></DialogActions>
  </Dialog>;
}
