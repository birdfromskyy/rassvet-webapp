import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, TextField } from '@mui/material';
import reporting from '../../services/monthlyReportingService';
import { errorText } from './model';

export default function ContractSettings() {
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(''); setConflict(false);
    reporting.settings(controller.signal).then(value => { if (!controller.signal.aborted) setDraft(value); }).catch(e => { if (!controller.signal.aborted) setError(errorText(e)); });
    return () => controller.abort();
  }, [reload]);
  const save = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      setDraft(await reporting.saveSettings({ revision: draft.revision, contract_number: draft.contract_number, contract_date: draft.contract_date || null }));
      setNotice('Договор сохранён. Уже созданные месяцы сохраняют прежние сведения до их явного обновления.');
    } catch (e) { setError(errorText(e)); setConflict(e.response?.status === 409); }
    finally { setBusy(false); }
  };
  return <Box>
    {error && <Alert severity='error' sx={{ mb: 2 }}>{error}<Button disabled={busy} onClick={() => { if (!draft || window.confirm('Загрузить сохранённый договор вместо введённых значений?')) setReload(n => n + 1); }}>Обновить</Button></Alert>}
    {notice && <Alert severity='success' sx={{ mb: 2 }}>{notice}</Alert>}
    {!draft && !error && <CircularProgress aria-label='Загрузка договора' />}
    {draft && <>
      <div className='monthly-services__fields'>
        <TextField label='Номер общего договора' disabled={busy || conflict} value={draft.contract_number} inputProps={{ maxLength: 100 }} onChange={e => setDraft({ ...draft, contract_number: e.target.value })} />
        <TextField label='Дата общего договора' disabled={busy || conflict} type='date' InputLabelProps={{ shrink: true }} value={draft.contract_date || ''} onChange={e => setDraft({ ...draft, contract_date: e.target.value })} />
      </div>
      <Button sx={{ mt: 2 }} variant='outlined' disabled={busy || conflict || !draft.contract_number.trim() || !draft.contract_date} onClick={save}>Сохранить договор</Button>
    </>}
  </Box>;
}
