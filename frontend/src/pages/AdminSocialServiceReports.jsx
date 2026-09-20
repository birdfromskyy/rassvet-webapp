import './AdminModule.scss';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ExcelJS from 'exceljs';
import {
  Autocomplete, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, Tab, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import { Add as AddIcon, ArrowBack as BackIcon, Delete as DeleteIcon, Edit as EditIcon, TableChart as ExcelIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';
import useBrandFont from '../hooks/useBrandFont';
import scheduleService from '../services/scheduleService';
import socialServiceReportService from '../services/socialServiceReportService';

const EMPTY_DIRECTORY_ITEM = { code: '', category: '', name: '', standard_duration_minutes: 30, periodicity: '', tariff_kopecks: 0, sort_order: 0, is_active: true };

const rubles = kopecks => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((Number(kopecks) || 0) / 100);
const minorToKopecks = value => Math.round(Number(String(value).replace(',', '.')) * 100) || 0;
const monthValue = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const reportMonthLabel = value => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(`${value}-01T12:00:00`)).replace(/^\d+\s+/, '');
const initials = name => String(name || '').trim().split(/\s+/).filter(Boolean).map((part, index) => index === 0 ? part : `${part[0]}.`).join(' ');
const safeName = value => String(value || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
const normalizePeriodicity = value => {
  const parts = String(value || '').trim().split(/\s+или\s+/i).map(item => item.trim()).filter(Boolean);
  if (parts.length < 2) return parts[0] || '';
  return /иппсу/i.test(parts[0]) ? parts[1] : parts[0];
};
const maximumMonthlyCount = periodicity => {
  const normalized = normalizePeriodicity(periodicity).toLowerCase();
  const match = normalized.match(/\d+/);
  if (!match) return 0;
  const count = Number(match[0]);
  if (normalized.includes('день')) return count * 31;
  if (normalized.includes('недел')) return count * 4;
  return count;
};

const grouped = services => services.reduce((result, service) => {
  const category = service.social_service?.category || service.category;
  if (!category) return result;
  if (!result[category]) result[category] = [];
  result[category].push(service);
  return result;
}, {});

const reportCategory = category => {
  const normalized = String(category || '').toLowerCase();
  if (normalized.includes('социально-быт')) return '1.Социально-бытовые';
  if (normalized.includes('социально-медицин')) return '2.Социально-медицинские';
  if (normalized.includes('социально-психолог')) return '3.Социально-психологические';
  if (normalized.includes('социально-педагог')) return '4.Социально-педагогические';
  if (normalized.includes('коммуникатив')) return '7. Услуги в целях повышения коммуникативного потенциала получателей социальных услуг, имеющих ограничения жизнедеятельности, в том числе детей инвалидов';
  return null;
};

const reportCategoryOrder = category => {
  const label = reportCategory(category);
  return ['1.', '2.', '3.', '4.', '7.'].findIndex(prefix => label?.startsWith(prefix));
};

const clone = value => value ? JSON.parse(JSON.stringify(value)) : value;
const copyTemplateRow = (source, target, sourceRow, targetRow) => {
  target.getRow(targetRow).height = source.getRow(sourceRow).height;
  for (let col = 1; col <= 16; col += 1) {
    const from = source.getCell(sourceRow, col);
    const to = target.getCell(targetRow, col);
    to.value = clone(from.value);
    to.style = clone(from.style);
  }
};
const copyTemplateMerge = (sourceRange, target, shift = 0) => {
  const match = sourceRange.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!match) return;
  target.mergeCells(`${match[1]}${Number(match[2]) + shift}:${match[3]}${Number(match[4]) + shift}`);
};
const configureAutoFitColumns = (source, target) => {
  [[3, 4], [5, 6], [9, 10, 11]].forEach(columns => {
    target.getColumn(columns[0]).width = columns.reduce((width, column) => width + (source.getColumn(column).width || 0), 0);
    columns.slice(1).forEach(column => { target.getColumn(column).hidden = true; });
  });
};
const templateCategoryRow = (source, label) => {
  for (let row = 19; row <= 48; row += 1) {
    if (String(source.getCell(row, 2).value || '').trim() === label) return row;
  }
  return 19;
};
const budgetText = totalKopecks => {
  const rubles = Math.floor(totalKopecks / 100);
  const kopecks = String(totalKopecks % 100).padStart(2, '0');
  return `Объем средств бюджета Ханты-Мансийского автономного округа – Югры ${rubles} руб. ${kopecks} коп.`;
};

const createReport = async (student, services, period) => {
  if (!services.length) { toast.error('У ребёнка не выбраны услуги'); return; }
  try {
    const response = await fetch('/report-templates/social-services-act-template.xlsx');
    if (!response.ok) { toast.error('Не удалось загрузить шаблон акта'); return; }
    const sourceBook = new ExcelJS.Workbook();
    await sourceBook.xlsx.load(await response.arrayBuffer());
    const source = sourceBook.worksheets[0];
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Рассвет';
    workbook.calcProperties.fullCalcOnLoad = true;
    workbook.calcProperties.forceFullCalc = true;
    const sheet = workbook.addWorksheet(initials(student.full_name).slice(0, 31) || 'Отчёт');
    sheet.properties = clone(source.properties);
    sheet.pageSetup = clone(source.pageSetup);
    sheet.views = clone(source.views);
    for (let col = 1; col <= 16; col += 1) sheet.getColumn(col).width = source.getColumn(col).width;
    configureAutoFitColumns(source, sheet);
    for (let row = 1; row <= 18; row += 1) copyTemplateRow(source, sheet, row, row);
    Object.values(source._merges).filter(range => range.bottom <= 18).forEach(range => copyTemplateMerge(range.range, sheet));
    const parsed = new Date(`${period}-01T12:00:00`);
    const lastDay = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0);
    const reportMonth = reportMonthLabel(period);
    sheet.getCell('D3').value = `от ${lastDay.getDate()} ${reportMonth} ${parsed.getFullYear()}г.`;
    sheet.getCell('B16').value = `Исполнитель в период с «01» ${reportMonth} ${parsed.getFullYear()}г. по «${String(lastDay.getDate()).padStart(2, '0')}» ${reportMonth} ${parsed.getFullYear()}г. выполнил обязательства по оказанию услуг (работ)`;
    let row = 19;
    let totalKopecks = 0;
    let totalMinutes = 0;
    let totalServices = 0;
    const groups = Object.entries(grouped(services))
      .map(([category, rows]) => ({ category, label: reportCategory(category), rows }))
      .filter(group => group.label)
      .sort((left, right) => reportCategoryOrder(left.category) - reportCategoryOrder(right.category));
    if (!groups.length) { toast.error('У выбранных услуг не указана категория'); return; }
    groups.forEach(({ label, rows }) => {
    copyTemplateRow(source, sheet, templateCategoryRow(source, label), row);
    sheet.mergeCells(row, 2, row, 14);
    sheet.getCell(row, 2).value = label;
    row += 1;
    rows.forEach((item, index) => {
      copyTemplateRow(source, sheet, 20, row);
      [4, 6, 10, 11].forEach(column => { sheet.getCell(row, column).value = null; });
      const count = Number(item.actual_monthly_count) || 0;
      const minutes = (Number(item.standard_duration_minutes) || 0) * count;
      const amount = (Number(item.tariff_kopecks) || 0) * count;
      totalKopecks += amount;
      totalMinutes += minutes;
      totalServices += count;
      sheet.getCell(row, 2).value = index + 1;
      sheet.getCell(row, 3).value = `${item.social_service.code} ${item.social_service.name}`;
      sheet.getCell(row, 5).value = item.periodicity;
      sheet.getCell(row, 7).value = item.standard_duration_minutes;
      sheet.getCell(row, 8).value = (Number(item.tariff_kopecks) || 0) / 100;
      sheet.getCell(row, 9).value = '-';
      sheet.getCell(row, 12).value = { formula: `G${row}*M${row}`, result: minutes };
      sheet.getCell(row, 13).value = count;
      sheet.getCell(row, 14).value = { formula: `H${row}*M${row}`, result: amount / 100 };
      sheet.getCell(row, 8).numFmt = '#,##0.00';
      sheet.getCell(row, 14).numFmt = '#,##0.00';
      sheet.getRow(row).height = undefined;
      row += 1;
    });
    });
    for (let sourceRow = 49; sourceRow <= 59; sourceRow += 1) copyTemplateRow(source, sheet, sourceRow, row + sourceRow - 49);
    Object.values(source._merges).filter(range => range.top >= 49 && range.bottom <= 59).forEach(range => copyTemplateMerge(range.range, sheet, row - 49));
    const totalRow = row;
    sheet.getCell(totalRow, 12).value = { formula: `SUM(L19:L${totalRow - 1})`, result: totalMinutes };
    sheet.getCell(totalRow, 13).value = { formula: `SUM(M19:M${totalRow - 1})`, result: totalServices };
    sheet.getCell(totalRow, 14).value = { formula: `SUM(N19:N${totalRow - 1})`, result: totalKopecks / 100 };
    sheet.getCell(row, 14).numFmt = '#,##0.00';
    sheet.getCell(totalRow + 6, 2).value = {
      formula: `"Объем средств бюджета Ханты-Мансийского автономного округа – Югры "&INT(N${totalRow})&" руб. "&TEXT(MOD(ROUND(N${totalRow}*100,0),100),"00")&" коп."`,
      result: budgetText(totalKopecks),
    };
    const footerStart = row + 12;
    for (let sourceRow = 61; sourceRow <= 67; sourceRow += 1) copyTemplateRow(source, sheet, sourceRow, footerStart + sourceRow - 61);
    Object.values(source._merges).filter(range => range.top >= 61).forEach(range => copyTemplateMerge(range.range, sheet, footerStart - 61));
    const buffer = await workbook.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Акт_${safeName(initials(student.full_name))}_${period}.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    toast.error('Не удалось сформировать акт');
  }
};

const AdminSocialServiceReports = () => {
  useBrandFont();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [directory, setDirectory] = useState([]);
  const [students, setStudents] = useState([]);
  const [student, setStudent] = useState(null);
  const [selected, setSelected] = useState([]);
  const [directoryDialog, setDirectoryDialog] = useState(null);
  const [studentDialog, setStudentDialog] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIDs, setPickerIDs] = useState([]);
  const [period, setPeriod] = useState(monthValue(new Date()));

  const loadDirectory = async () => setDirectory(await socialServiceReportService.getDirectory(true));
  useEffect(() => {
    Promise.all([loadDirectory(), scheduleService.getStudents(), scheduleService.getStudents({ archived: true })])
      .then(([, active, archived]) => {
        const byId = new Map([...active, ...archived].map(item => [item.id, item]));
        setStudents([...byId.values()].sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru')));
      })
      .catch(() => toast.error('Не удалось загрузить данные'));
  }, []);
  useEffect(() => { if (student?.id) socialServiceReportService.getStudentServices(student.id).then(setSelected).catch(() => toast.error('Не удалось загрузить услуги ребёнка')); else setSelected([]); }, [student]);
  const activeDirectory = useMemo(() => directory.filter(item => item.is_active), [directory]);
  const directoryGroups = useMemo(() => grouped(directory), [directory]);
  const pickerGroups = useMemo(() => grouped(activeDirectory), [activeDirectory]);
  const selectedGroups = useMemo(() => grouped(selected), [selected]);
  const selectedServiceIDs = selected.map(item => item.social_service_id);

  const saveDirectory = async () => {
    const data = { ...directoryDialog.data, tariff_kopecks: minorToKopecks(directoryDialog.data.tariff_rub) };
    try {
      if (directoryDialog.id) await socialServiceReportService.updateDirectoryItem(directoryDialog.id, data); else await socialServiceReportService.createDirectoryItem(data);
      setDirectoryDialog(null); await loadDirectory(); toast.success('Сохранено');
    } catch (error) { toast.error(error.response?.data?.error || 'Не удалось сохранить'); }
  };
  const savePicker = async () => {
    try { setSelected(await socialServiceReportService.selectStudentServices(student.id, pickerIDs)); setPickerOpen(false); toast.success('Сохранено'); }
    catch (error) { toast.error(error.response?.data?.error || 'Не удалось сохранить'); }
  };
  const saveStudentItem = async () => {
    const periodicity = normalizePeriodicity(studentDialog.data.periodicity);
    const data = { ...studentDialog.data, periodicity, maximum_monthly_count: maximumMonthlyCount(periodicity), tariff_kopecks: minorToKopecks(studentDialog.data.tariff_rub) };
    try {
      await socialServiceReportService.updateStudentService(student.id, studentDialog.id, data);
      setSelected(await socialServiceReportService.getStudentServices(student.id)); setStudentDialog(null); toast.success('Сохранено');
    } catch (error) { toast.error(error.response?.data?.error || 'Не удалось сохранить'); }
  };
  const removeDirectory = async item => { if (!window.confirm(`Удалить услугу «${item.name}»?`)) return; try { await socialServiceReportService.deleteDirectoryItem(item.id); await loadDirectory(); } catch (error) { toast.error(error.response?.data?.error || 'Не удалось удалить'); } };
  const removeStudentItem = async item => { if (!window.confirm(`Убрать услугу «${item.social_service.name}» у ребёнка?`)) return; try { await socialServiceReportService.deleteStudentService(student.id, item.id); setSelected(await socialServiceReportService.getStudentServices(student.id)); } catch { toast.error('Не удалось удалить'); } };
  return <main className='admin-module'>
    <div className='admin-module__container'>
      <section className='admin-module__hero'>
        <div><span className='admin-module__badge'>Отчётность</span><h1>Социальные услуги</h1></div>
        <div className='admin-module__actions'><Button startIcon={<BackIcon />} onClick={() => navigate('/admin/schedule')} className='admin-module__button admin-module__button--ghost'>Назад</Button></div>
      </section>
      <section className='admin-module__panel'>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 3 }}><Tab label='Услуги ребёнка' /><Tab label='Справочник услуг' /></Tabs>
        {tab === 0 && <>
          <Box display='grid' gridTemplateColumns={{ xs: '1fr', md: 'minmax(280px, 520px) minmax(200px, 1fr)' }} gap={2} mb={3} alignItems='center'>
            <Autocomplete options={students} value={student} onChange={(_, value) => setStudent(value)} getOptionLabel={item => item?.full_name || ''} renderInput={params => <TextField {...params} label='Ребёнок' />} />
            <TextField label='Месяц отчёта' type='month' value={period} onChange={event => setPeriod(event.target.value)} InputLabelProps={{ shrink: true }} />
            <Box display='flex' gap={1} flexWrap='wrap'>
              <Button size='small' variant='outlined' color='success' startIcon={<ExcelIcon />} disabled={!student} onClick={() => createReport(student, selected, period)}>Скачать акт</Button>
              <Button size='small' variant='outlined' startIcon={<AddIcon />} disabled={!student} onClick={() => { setPickerIDs(selectedServiceIDs); setPickerOpen(true); }}>Выбрать услуги</Button>
            </Box>
          </Box>
          {student && !selected.length && <TableContainer><Table><TableBody><TableRow><TableCell align='center'>Услуги ещё не выбраны</TableCell></TableRow></TableBody></Table></TableContainer>}
          {student && Object.entries(selectedGroups).map(([category, services]) => <Box key={category} mb={3}>
            <Typography variant='h6' sx={{ mb: 1 }}>{category}</Typography>
            <TableContainer><Table><TableHead><TableRow><TableCell>Услуга</TableCell><TableCell>Периодичность</TableCell><TableCell align='center'>Максимум</TableCell><TableCell align='center'>Фактически, услуг</TableCell><TableCell align='center'>Фактически, мин.</TableCell><TableCell align='center'>Стандарт, мин.</TableCell><TableCell align='right'>Тариф</TableCell><TableCell align='right'>Сумма</TableCell><TableCell align='right'>Действия</TableCell></TableRow></TableHead><TableBody>
              {services.map(item => <TableRow key={item.id}><TableCell>{item.social_service.code} {item.social_service.name}</TableCell><TableCell>{normalizePeriodicity(item.periodicity)}</TableCell><TableCell align='center'>{maximumMonthlyCount(item.periodicity)}</TableCell><TableCell align='center'>{item.actual_monthly_count}</TableCell><TableCell align='center'>{(Number(item.actual_monthly_count) || 0) * (Number(item.standard_duration_minutes) || 0)}</TableCell><TableCell align='center'>{item.standard_duration_minutes} мин.</TableCell><TableCell align='right'>{rubles(item.tariff_kopecks)} ₽</TableCell><TableCell align='right'>{rubles(item.tariff_kopecks * item.actual_monthly_count)} ₽</TableCell><TableCell align='right'><IconButton onClick={() => { const periodicity = normalizePeriodicity(item.periodicity); setStudentDialog({ id: item.id, title: item.social_service.name, data: { ...item, periodicity, maximum_monthly_count: maximumMonthlyCount(periodicity), tariff_rub: rubles(item.tariff_kopecks) } }); }}><EditIcon /></IconButton><IconButton color='error' onClick={() => removeStudentItem(item)}><DeleteIcon /></IconButton></TableCell></TableRow>)}
            </TableBody></Table></TableContainer>
          </Box>)}
        </>}
        {tab === 1 && <>
          <Box display='flex' justifyContent='flex-end' mb={2}><Button variant='contained' startIcon={<AddIcon />} onClick={() => setDirectoryDialog({ data: { ...EMPTY_DIRECTORY_ITEM, tariff_rub: '0,00' } })}>Добавить услугу</Button></Box>
          {Object.entries(directoryGroups).map(([category, services]) => <Box key={category} mb={3}><Typography variant='h6' sx={{ mb: 1 }}>{category}</Typography><TableContainer><Table size='small'><TableHead><TableRow><TableCell>Код</TableCell><TableCell>Услуга</TableCell><TableCell align='center'>Время</TableCell><TableCell>Периодичность</TableCell><TableCell align='right'>Тариф</TableCell><TableCell align='right'>Действия</TableCell></TableRow></TableHead><TableBody>{services.map(item => <TableRow key={item.id} sx={{ opacity: item.is_active ? 1 : .5 }}><TableCell>{item.code}</TableCell><TableCell>{item.name}</TableCell><TableCell align='center'>{item.standard_duration_minutes} мин.</TableCell><TableCell>{normalizePeriodicity(item.periodicity)}</TableCell><TableCell align='right'>{rubles(item.tariff_kopecks)} ₽</TableCell><TableCell align='right'><IconButton onClick={() => setDirectoryDialog({ id: item.id, data: { ...item, periodicity: normalizePeriodicity(item.periodicity), tariff_rub: rubles(item.tariff_kopecks) } })}><EditIcon /></IconButton><IconButton color='error' onClick={() => removeDirectory(item)}><DeleteIcon /></IconButton></TableCell></TableRow>)}</TableBody></Table></TableContainer></Box>)}
        </>}
      </section>
    </div>
    <Dialog open={Boolean(directoryDialog)} onClose={() => setDirectoryDialog(null)} fullWidth maxWidth='sm'><DialogTitle>{directoryDialog?.id ? 'Изменить услугу' : 'Новая услуга'}</DialogTitle><DialogContent><Box display='grid' gap={2} pt={1}>{directoryDialog && <>
      <Box display='grid' gridTemplateColumns='1fr 2fr' gap={2}><TextField label='Код' value={directoryDialog.data.code} onChange={event => setDirectoryDialog({ ...directoryDialog, data: { ...directoryDialog.data, code: event.target.value } })} /><TextField label='Категория' value={directoryDialog.data.category} onChange={event => setDirectoryDialog({ ...directoryDialog, data: { ...directoryDialog.data, category: event.target.value } })} /></Box>
      <TextField label='Наименование' multiline minRows={3} value={directoryDialog.data.name} onChange={event => setDirectoryDialog({ ...directoryDialog, data: { ...directoryDialog.data, name: event.target.value } })} />
      <Box display='grid' gridTemplateColumns='1fr 1fr' gap={2}><TextField label='Время, мин.' type='number' value={directoryDialog.data.standard_duration_minutes} onChange={event => setDirectoryDialog({ ...directoryDialog, data: { ...directoryDialog.data, standard_duration_minutes: Number(event.target.value) } })} /><TextField label='Тариф, ₽' value={directoryDialog.data.tariff_rub} onChange={event => setDirectoryDialog({ ...directoryDialog, data: { ...directoryDialog.data, tariff_rub: event.target.value } })} /></Box>
      <TextField label='Периодичность' value={directoryDialog.data.periodicity} onChange={event => setDirectoryDialog({ ...directoryDialog, data: { ...directoryDialog.data, periodicity: event.target.value } })} />
      <TextField label='Порядок' type='number' value={directoryDialog.data.sort_order} onChange={event => setDirectoryDialog({ ...directoryDialog, data: { ...directoryDialog.data, sort_order: Number(event.target.value) } })} />
      <FormControlLabel control={<Checkbox checked={Boolean(directoryDialog.data.is_active)} onChange={event => setDirectoryDialog({ ...directoryDialog, data: { ...directoryDialog.data, is_active: event.target.checked } })} />} label='Активна' />
    </>}</Box></DialogContent><DialogActions><Button onClick={() => setDirectoryDialog(null)}>Отмена</Button><Button variant='contained' onClick={saveDirectory}>Сохранить</Button></DialogActions></Dialog>
    <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} fullWidth maxWidth='md'>
      <DialogTitle>Выберите услуги</DialogTitle>
      <DialogContent>{Object.entries(pickerGroups).map(([category, services]) => {
        const ids = services.map(item => item.id);
        const allChecked = ids.every(id => pickerIDs.includes(id));
        return <Box key={category} mb={2}>
          <FormControlLabel label={category} control={<Checkbox checked={allChecked} indeterminate={!allChecked && ids.some(id => pickerIDs.includes(id))} onChange={event => setPickerIDs(event.target.checked ? [...new Set([...pickerIDs, ...ids])] : pickerIDs.filter(id => !ids.includes(id)))} />} />
          <Box pl={3}>{services.map(item => <FormControlLabel key={item.id} label={item.name} control={<Checkbox checked={pickerIDs.includes(item.id)} onChange={event => setPickerIDs(event.target.checked ? [...pickerIDs, item.id] : pickerIDs.filter(id => id !== item.id))} />} sx={{ display: 'flex' }} />)}</Box>
        </Box>;
      })}</DialogContent>
      <DialogActions><Button onClick={() => setPickerIDs(activeDirectory.map(item => item.id))}>Выбрать всё</Button><Button onClick={() => setPickerOpen(false)}>Отмена</Button><Button variant='contained' onClick={savePicker}>Сохранить</Button></DialogActions>
    </Dialog>
    <Dialog open={Boolean(studentDialog)} onClose={() => setStudentDialog(null)} fullWidth maxWidth='sm'><DialogTitle>{studentDialog?.title}</DialogTitle><DialogContent><Box display='grid' gap={2} pt={1}>{studentDialog && <>
      <TextField label='Периодичность' value={studentDialog.data.periodicity} onChange={event => { const periodicity = event.target.value; setStudentDialog({ ...studentDialog, data: { ...studentDialog.data, periodicity, maximum_monthly_count: maximumMonthlyCount(periodicity) } }); }} onBlur={() => { const periodicity = normalizePeriodicity(studentDialog.data.periodicity); setStudentDialog({ ...studentDialog, data: { ...studentDialog.data, periodicity, maximum_monthly_count: maximumMonthlyCount(periodicity) } }); }} />
      <Box display='grid' gridTemplateColumns='1fr 1fr' gap={2}><TextField label='Максимум за месяц' type='number' value={studentDialog.data.maximum_monthly_count} InputProps={{ readOnly: true }} helperText='Рассчитывается по периодичности' /><TextField label='Фактически оказано, услуг' type='number' value={studentDialog.data.actual_monthly_count} onChange={event => setStudentDialog({ ...studentDialog, data: { ...studentDialog.data, actual_monthly_count: Number(event.target.value) } })} /></Box>
      <TextField label='Фактически затрачено, мин.' value={(Number(studentDialog.data.actual_monthly_count) || 0) * (Number(studentDialog.data.standard_duration_minutes) || 0)} InputProps={{ readOnly: true }} helperText='Рассчитывается по количеству услуг и стандартному времени' />
      <Box display='grid' gridTemplateColumns='1fr 1fr' gap={2}><TextField label='Время, мин.' type='number' value={studentDialog.data.standard_duration_minutes} onChange={event => setStudentDialog({ ...studentDialog, data: { ...studentDialog.data, standard_duration_minutes: Number(event.target.value) } })} /><TextField label='Тариф, ₽' value={studentDialog.data.tariff_rub} onChange={event => setStudentDialog({ ...studentDialog, data: { ...studentDialog.data, tariff_rub: event.target.value } })} /></Box>
    </>}</Box></DialogContent><DialogActions><Button onClick={() => setStudentDialog(null)}>Отмена</Button><Button variant='contained' onClick={saveStudentItem}>Сохранить</Button></DialogActions></Dialog>
  </main>;
};

export default AdminSocialServiceReports;
