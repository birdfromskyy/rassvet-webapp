import './AdminModule.scss';
import './monthly-services/MonthlyServices.scss';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Autocomplete, Box, Button, CircularProgress, Tab, Tabs, TextField, Typography } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import useBrandFont from '../hooks/useBrandFont';
import reporting from '../services/monthlyReportingService';
import MonthlyServiceEditor from './monthly-services/MonthlyServiceEditor';
import Directory from './monthly-services/Directory';
import ContractSettings from './monthly-services/ContractSettings';
import { errorText, validMonth } from './monthly-services/model';

export default function AdminMonthlySocialServices() {
  useBrandFont();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [student, setStudent] = useState(null);
  const [month, setMonth] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; });
  const [monthInput, setMonthInput] = useState(month);
  const [tab, setTab] = useState(0);
  const [state, setState] = useState({ dirty: false, busy: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const updateState = useCallback(value => setState(value), []);
  const updatePerson = useCallback(value => {
    setStudents(list => list.map(row => row.id === value.id ? value : row));
    setStudent(current => current?.id === value.id ? value : current);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    Promise.all([reporting.students(controller.signal), reporting.directory(controller.signal)]).then(([people, services]) => {
      if (controller.signal.aborted) return;
      setStudents(people); setDirectory(services);
    }).catch(e => { if (!controller.signal.aborted) setError(errorText(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  const mayLeave = () => !state.busy && (!state.dirty || window.confirm('Есть несохранённые изменения месяца. Продолжить без сохранения?'));
  const chooseMonth = value => {
    setMonthInput(value);
    if (validMonth(value) && value !== month) {
      if (mayLeave()) setMonth(value); else setMonthInput(month);
    }
  };
  return <main className='admin-module'>
    <div className='admin-module__container'>
      <section className='admin-module__hero'>
        <div><span className='admin-module__badge'>Отчётность</span><h1>Социальные услуги</h1></div>
        <Button startIcon={<ArrowBack />} disabled={state.busy} className='admin-module__button admin-module__button--ghost' onClick={() => { if (mayLeave()) navigate('/admin/schedule'); }}>Назад</Button>
      </section>
      <section className='admin-module__panel'>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant='scrollable' allowScrollButtonsMobile sx={{ mb: 3 }}>
          <Tab label='Услуги ребёнка' disabled={state.busy} /><Tab label='Справочник услуг' disabled={state.busy} /><Tab label='Общий договор' disabled={state.busy} />
        </Tabs>
        {error && <Alert severity='error' action={<Button onClick={() => setReload(n => n + 1)}>Повторить</Button>}>{error}</Alert>}
        {loading && <CircularProgress aria-label='Загрузка справочников' />}
        {!loading && !error && <>
          <Box hidden={tab !== 0}>
            <div className='monthly-services__selectors'>
              <Autocomplete disabled={state.busy} options={students} value={student} isOptionEqualToValue={(a, b) => a.id === b.id} getOptionLabel={row => `${row.full_name}${row.archived_at ? ' — архив' : !row.is_active ? ' — на паузе' : ''}`} onChange={(_, value) => { if (mayLeave()) { setStudent(value); setState({ dirty: false, busy: false }); } }} renderInput={params => <TextField {...params} label='Ребёнок' />} />
              <TextField label='Месяц отчёта' type='month' disabled={state.busy} value={monthInput} error={!validMonth(monthInput)} helperText={!validMonth(monthInput) ? 'Выберите месяц и год' : ''} inputProps={{ min: '0001-01', max: '9998-12' }} InputLabelProps={{ shrink: true }} onChange={e => chooseMonth(e.target.value)} onBlur={() => { if (!validMonth(monthInput)) setMonthInput(month); }} />
            </div>
            {student ? <MonthlyServiceEditor studentId={student.id} month={month} directory={directory} onStateChange={updateState} onPersonSaved={updatePerson} /> : <Typography sx={{ py: 4 }}>Выберите ребёнка</Typography>}
          </Box>
          <Box hidden={tab !== 1}><Directory directory={directory} onChanged={setDirectory} /></Box>
          <Box hidden={tab !== 2}><ContractSettings /></Box>
        </>}
      </section>
    </div>
  </main>;
}
