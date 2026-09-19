import './AdminModule.scss';
import './monthly-services/MonthlyServices.scss';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Autocomplete, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Tab, Tabs, TextField, Typography } from '@mui/material';
import { ArrowBack, EditOutlined } from '@mui/icons-material';
import useBrandFont from '../hooks/useBrandFont';
import reporting from '../services/monthlyReportingService';
import scheduleService from '../services/scheduleService';
import socialServices from '../services/socialServiceReportService';
import ContractSettings from './monthly-services/ContractSettings';
import Directory from './monthly-services/Directory';
import PeopleDialog from './monthly-services/PeopleDialog';
import ServicePicker from './monthly-services/ServicePicker';
import { errorText, frequencyMaximum, groups, rubles } from './monthly-services/model';

const identityFromFullName = student => {
  if (!student || student.last_name || student.first_name) return student;
  const [lastName = '', firstName = '', ...middleName] = String(student.full_name || '').trim().split(/\s+/);
  return { ...student, last_name: lastName, first_name: firstName, middle_name: middleName.join(' ') };
};

export default function AdminMonthlySocialServices() {
  useBrandFont();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [students, setStudents] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [student, setStudent] = useState(null);
  const [selected, setSelected] = useState([]);
  const [validUntil, setValidUntil] = useState('');
  const [savedValidUntil, setSavedValidUntil] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [picker, setPicker] = useState(false);
  const [people, setPeople] = useState(null);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    Promise.all([reporting.students(controller.signal), reporting.directory(controller.signal)])
      .then(([studentRows, serviceRows]) => {
        if (!controller.signal.aborted) {
          setStudents(studentRows.map(identityFromFullName));
          setDirectory(serviceRows);
        }
      })
      .catch(e => { if (!controller.signal.aborted) setError(errorText(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const loadStudent = useCallback(async value => {
    setStudent(value); setSelected([]); setValidUntil(''); setSavedValidUntil(''); setError(''); setNotice('');
    if (!value) return;
    setBusy(true);
    try {
      const [services, validities] = await Promise.all([socialServices.getStudentServices(value.id), scheduleService.getStudentServiceValidities(value.id)]);
      setSelected(services);
      const ippsu = validities.find(row => row.service_type === 'ippsu');
      const date = ippsu?.valid_until ? String(ippsu.valid_until).slice(0, 10) : '';
      setValidUntil(date); setSavedValidUntil(date);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }, []);

  const saveSelection = async ids => {
    setBusy(true); setError(''); setNotice('');
    try {
      setSelected(await socialServices.selectStudentServices(student.id, ids));
      setPicker(false); setNotice('Услуги по ИППСУ сохранены');
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };

  const saveValidity = async () => {
    if (!validUntil) { setError('Укажите срок действия ИППСУ'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await scheduleService.saveStudentServiceValidity(student.id, { service_type: 'ippsu', valid_until: validUntil });
      setSavedValidUntil(validUntil); setNotice('Срок действия ИППСУ сохранён');
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };

  const openPeople = async () => {
    setBusy(true); setError('');
    try {
      const child = identityFromFullName(await reporting.student(student.id));
      const links = await reporting.links(student.id);
      const representatives = await reporting.representatives();
      setPeople({ child, links, representatives });
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };

  const saveItem = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const periodicity = editing.periodicity.trim();
      await socialServices.updateStudentService(student.id, editing.id, {
        periodicity,
        maximum_monthly_count: frequencyMaximum(periodicity) || 0,
        actual_monthly_count: editing.actual_monthly_count || 0,
        standard_duration_minutes: Number(editing.standard_duration_minutes),
        tariff_kopecks: Number(editing.tariff_kopecks),
      });
      setSelected(await socialServices.getStudentServices(student.id));
      setEditing(null); setNotice('Параметры услуги сохранены');
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };

  const groupedServices = useMemo(() => groups(selected.map(row => ({ ...row.social_service, ...row }))), [selected]);

  return <main className='admin-module'><div className='admin-module__container'>
    <section className='admin-module__hero'>
      <div><span className='admin-module__badge'>Отчётность</span><h1>Социальные услуги</h1></div>
      <Button startIcon={<ArrowBack />} className='admin-module__button admin-module__button--ghost' onClick={() => navigate('/admin/schedule')}>Назад</Button>
    </section>
    <section className='admin-module__panel'>
      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant='scrollable' allowScrollButtonsMobile sx={{ mb: 3 }}>
        <Tab label='Услуги ребёнка' /><Tab label='Справочник услуг' /><Tab label='Общий договор' />
      </Tabs>
      {error && <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity='success' onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}
      {loading && <CircularProgress aria-label='Загрузка данных' />}
      {!loading && tab === 0 && <>
        <Autocomplete options={students} value={student} disabled={busy} isOptionEqualToValue={(a, b) => a.id === b.id} getOptionLabel={row => `${row.full_name}${row.archived_at ? ' — архив' : !row.is_active ? ' — на паузе' : ''}`} onChange={(_, value) => loadStudent(value)} renderInput={params => <TextField {...params} label='Ребёнок' />} />
        {!student && <Typography sx={{ py: 5 }} color='text.secondary'>Выберите ребёнка, чтобы настроить услуги по его ИППСУ.</Typography>}
        {student && <Box className='monthly-services' mt={3}>
          <section className='monthly-services__ippsu-card'>
            <div><Typography component='h2' variant='h6' fontWeight={700}>ИППСУ ребёнка</Typography><Typography variant='body2' color='text.secondary'>Укажите срок документа и выберите услуги, которые положены ребёнку.</Typography></div>
            <TextField label='Действует до' type='date' value={validUntil} disabled={busy} InputLabelProps={{ shrink: true }} onChange={e => setValidUntil(e.target.value)} />
            <Button className='monthly-services__button monthly-services__button--secondary' disabled={busy || !validUntil || validUntil === savedValidUntil} onClick={saveValidity}>Сохранить срок</Button>
            <Button className='monthly-services__button monthly-services__button--secondary' disabled={busy} onClick={openPeople}>Карточка ребёнка и родителей</Button>
          </section>
          <div className='monthly-services__section-heading'>
            <div><Typography component='h2' variant='h6' fontWeight={700}>Услуги по ИППСУ</Typography><Typography variant='body2' color='text.secondary'>Список действует до следующего изменения ИППСУ.</Typography></div>
            <Button className='monthly-services__button monthly-services__button--primary' disabled={busy} onClick={() => setPicker(true)}>{selected.length ? 'Изменить услуги' : 'Выбрать услуги'}</Button>
          </div>
          {!selected.length && <Alert severity='info'>Для ребёнка пока не выбраны услуги по ИППСУ.</Alert>}
          {groupedServices.map(([category, rows]) => <section key={category} className='monthly-services__category'>
            <h2>{category}</h2>
            {rows.map(row => <article key={row.id} className='monthly-services__assignment'>
              <div><Typography component='h3' fontWeight={600}>{row.code} — {row.name}</Typography><Typography variant='body2'>{row.periodicity} · максимум {row.maximum_monthly_count} в месяц · {row.standard_duration_minutes} мин. · {rubles(row.tariff_kopecks)} ₽</Typography></div>
              <Button startIcon={<EditOutlined />} className='monthly-services__button monthly-services__button--secondary' onClick={() => setEditing(selected.find(item => item.id === row.id))}>Изменить</Button>
            </article>)}
          </section>)}
        </Box>}
      </>}
      {!loading && tab === 1 && <Directory directory={directory} onChanged={setDirectory} />}
      {!loading && tab === 2 && <ContractSettings />}
    </section>
  </div>
  {picker && <ServicePicker directory={directory} rows={selected.map(row => ({ ...row, ...row.social_service }))} onClose={() => setPicker(false)} onApply={saveSelection} />}
  {people && <PeopleDialog student={people.child} representatives={people.representatives} links={people.links} onClose={() => setPeople(null)} onSaved={({ student: saved, ...rest }) => {
    setPeople(current => ({ ...current, child: saved, ...rest }));
    setStudents(rows => rows.map(row => row.id === saved.id ? saved : row));
    setStudent(saved); setNotice('Карточка ребёнка и родителя сохранена');
  }} />}
  {editing && <Dialog open onClose={() => !busy && setEditing(null)} fullWidth maxWidth='sm'>
    <DialogTitle>Параметры услуги</DialogTitle><DialogContent>
      <Typography fontWeight={600} mb={2}>{editing.social_service.name}</Typography><Box display='grid' gap={2}>
        <TextField label='Периодичность по ИППСУ' value={editing.periodicity} disabled={busy} onChange={e => setEditing({ ...editing, periodicity: e.target.value })} />
        <TextField label='Максимум в месяц' value={frequencyMaximum(editing.periodicity) ?? 'Не определяется автоматически'} InputProps={{ readOnly: true }} />
        <TextField label='Стандартное время, мин.' type='number' value={editing.standard_duration_minutes} disabled={busy} onChange={e => setEditing({ ...editing, standard_duration_minutes: e.target.value })} />
        <TextField label='Тариф, ₽' value={rubles(editing.tariff_kopecks)} InputProps={{ readOnly: true }} />
      </Box>
    </DialogContent><DialogActions><Button disabled={busy} onClick={() => setEditing(null)}>Отмена</Button><Button disabled={busy} variant='contained' onClick={saveItem}>Сохранить</Button></DialogActions>
  </Dialog>}
  </main>;
}
