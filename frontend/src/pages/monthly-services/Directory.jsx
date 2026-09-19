import React, { useState } from 'react';
import { Alert, Autocomplete, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, TextField, Typography } from '@mui/material';
import { Add, Edit } from '@mui/icons-material';
import reporting from '../../services/monthlyReportingService';
import { errorText, groups, integer, kopecks, matches, priceInput, rubles } from './model';

export default function Directory({ directory, onChanged }) {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const close = () => { if (!busy) setDraft(null); };
  const save = async () => {
    setError('');
    let body;
    try {
      body = { code: draft.code.trim(), category: draft.category.trim(), name: draft.name.trim(), periodicity: draft.periodicity.trim(), standard_duration_minutes: integer(draft.standard_duration_minutes, 1, 1440, 'Стандартное время'), tariff_kopecks: kopecks(draft.tariff_rub), sort_order: integer(draft.sort_order, 0, 100000, 'Порядок'), is_active: draft.is_active };
      if (!body.code || !body.category || !body.name || !body.periodicity) throw new Error('Заполните код, категорию, название и периодичность');
    } catch (e) { setError(e.message); return; }
    setBusy(true);
    try {
      const saved = await reporting.saveService(draft.id, body);
      onChanged([...directory.filter(row => row.id !== saved.id), saved]); setDraft(null);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };
  return <Box>
    {!draft && error && <Alert severity='error'>{error}</Alert>}
    <div className='monthly-services__directory-tools'>
      <TextField className='monthly-services__search' label='Найти услугу по названию или коду' value={query} onChange={e => setQuery(e.target.value)} />
      <div className='monthly-services__directory-actions'>
        <Button className='monthly-services__button monthly-services__button--primary' startIcon={<Add />} disabled={busy} onClick={() => { setError(''); setDraft({ code: '', category: '', name: '', periodicity: '', standard_duration_minutes: 30, tariff_rub: '0,00', sort_order: 0, is_active: true }); }}>Новая услуга</Button>
      </div>
    </div>
    {groups(directory.filter(row => matches(row, query))).map(([category, rows]) => <section key={category} className='monthly-services__category'>
      <h2>{category}</h2>
      {rows.map(row => <article key={row.id} className='monthly-services__directory-row'>
        <div><Typography fontWeight={600}>{row.code} — {row.name}{!row.is_active && ' · Архив'}</Typography><Typography variant='body2'>{row.periodicity} · {row.standard_duration_minutes} мин. · {rubles(row.tariff_kopecks)} ₽</Typography></div>
        <Button className='monthly-services__edit-button' startIcon={<Edit />} disabled={busy} onClick={() => { setError(''); setDraft({ ...row, tariff_rub: priceInput(row.tariff_kopecks) }); }}>Изменить</Button>
      </article>)}
    </section>)}
    {!directory.length && <Typography sx={{ py: 3 }}>Справочник пока пуст</Typography>}
    {draft && <Dialog open onClose={close} fullWidth maxWidth='sm'>
      <DialogTitle>{draft.id ? 'Изменить услугу' : 'Новая услуга'}</DialogTitle>
      <DialogContent>
        {error && <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert>}
        <Box display='grid' gap={2} pt={1}>
          <TextField label='Код' disabled={busy} inputProps={{ maxLength: 32 }} value={draft.code} onChange={e => update('code', e.target.value)} />
          <Autocomplete freeSolo disabled={busy} options={[...new Set(directory.map(row => row.category))]} inputValue={draft.category} onInputChange={(_, value) => update('category', value)} renderInput={params => <TextField {...params} label='Категория' />} />
          <TextField label='Наименование' multiline minRows={2} disabled={busy} value={draft.name} onChange={e => update('name', e.target.value)} />
          <TextField label='Периодичность' disabled={busy} inputProps={{ maxLength: 255 }} value={draft.periodicity} onChange={e => update('periodicity', e.target.value)} />
          <TextField label='Стандартное время, мин.' type='number' disabled={busy} value={draft.standard_duration_minutes} onChange={e => update('standard_duration_minutes', e.target.value)} />
          <TextField label='Тариф, ₽' disabled={busy} inputProps={{ inputMode: 'decimal' }} value={draft.tariff_rub} onChange={e => update('tariff_rub', e.target.value)} />
          <TextField label='Порядок' type='number' disabled={busy} value={draft.sort_order} onChange={e => update('sort_order', e.target.value)} />
          <FormControlLabel label='Активна' control={<Checkbox disabled={busy} checked={draft.is_active} onChange={e => update('is_active', e.target.checked)} />} />
        </Box>
      </DialogContent>
      <DialogActions><Button disabled={busy} onClick={close}>Отмена</Button><Button disabled={busy} variant='contained' onClick={save}>Сохранить</Button></DialogActions>
    </Dialog>}
  </Box>;
}
