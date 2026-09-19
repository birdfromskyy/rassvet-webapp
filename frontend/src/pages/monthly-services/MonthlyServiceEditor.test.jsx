import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import MonthlyServiceEditor from './MonthlyServiceEditor';
import reporting from '../../services/monthlyReportingService';

vi.mock('../../services/monthlyReportingService', () => ({ __esModule: true, default: {
  month: vi.fn(), student: vi.fn(), representatives: vi.fn(), links: vi.fn(), legacy: vi.fn(), create: vi.fn(), save: vi.fn(), transition: vi.fn(),
} }));
const student = { id: 1, full_name: 'Тестов Иван', last_name: 'Тестов', first_name: 'Иван', birth_date: '2016-02-29', identity_revision: 1 };
const service = { id: 11, code: 'T1', category: 'Социально-бытовые', name: 'Тестовая услуга', periodicity: '2 раза в неделю', standard_duration_minutes: 30, tariff_kopecks: 35571, is_active: true };
const item = { ...service, social_service_id: 11, maximum_monthly_count: 8, actual_monthly_count: null };
const monthly = (overrides = {}) => ({ revision: 3, status: 'draft', representative_id: null, month: '2026-09-01', snapshot: { student, representative: null }, items: [item], ...overrides });
const props = { studentId: 1, month: '2026-09', directory: [service], onStateChange: vi.fn(), onPersonSaved: vi.fn() };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
beforeEach(() => {
  vi.clearAllMocks();
  reporting.month.mockResolvedValue(monthly()); reporting.student.mockResolvedValue(student);
  reporting.representatives.mockResolvedValue([]); reporting.links.mockResolvedValue([]); reporting.legacy.mockResolvedValue([]);
  Object.defineProperty(window, 'crypto', { configurable: true, value: { randomUUID: vi.fn(() => 'synthetic-request-id-123') } });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());
const ready = () => screen.findByLabelText('Фактически: Тестовая услуга');
test('new empty month selects grouped services and creates nullable facts', async () => {
  reporting.month.mockResolvedValue(null);
  reporting.create.mockResolvedValue(monthly({ revision: 1 }));
  render(<MonthlyServiceEditor {...props} />);
  await screen.findByText('В этом месяце услуги ещё не выбраны.');
  fireEvent.click(screen.getByText('Изменить список услуг'));
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByLabelText('Социально-бытовые'));
  fireEvent.click(within(dialog).getByText('Сохранить услуги (1)'));
  fireEvent.click(screen.getByText('Сохранить месяц'));
  await waitFor(() => expect(reporting.create).toHaveBeenCalledWith(1, '2026-09', expect.objectContaining({ mode: 'create', representative_id: null, items: [expect.objectContaining({ actual_monthly_count: null, maximum_monthly_count: 8 })] })));
});
test('zero is explicit, null remains empty, successful save and reload preserve zero', async () => {
  reporting.save.mockResolvedValue(monthly({ revision: 4, items: [{ ...item, actual_monthly_count: 0 }] }));
  render(<MonthlyServiceEditor {...props} />);
  const actual = await ready();
  expect(actual.value).toBe('');
  expect(screen.getByText('Зафиксировать месяц')).toBeDisabled();
  fireEvent.change(actual, { target: { value: '0' } });
  expect(screen.getByText('Подтверждено: 0')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Сохранить месяц'));
  await waitFor(() => expect(reporting.save).toHaveBeenCalledWith(1, '2026-09', expect.objectContaining({ revision: 3, representative_id: null, items: [expect.objectContaining({ actual_monthly_count: 0 })] })));
  await screen.findByText('Сохранено');
  reporting.month.mockResolvedValue(monthly({ revision: 4, items: [{ ...item, actual_monthly_count: 0 }] }));
  fireEvent.click(screen.getByText('Обновить'));
  expect((await ready()).value).toBe('0');
});
test.each([['network', new Error('Нет связи')], ['conflict', { response: { status: 409 } }]])('%s never destroys entered facts', async (_, failure) => {
  reporting.save.mockRejectedValue(failure);
  render(<MonthlyServiceEditor {...props} />);
  fireEvent.change(await ready(), { target: { value: '5' } });
  fireEvent.click(screen.getByText('Сохранить месяц'));
  await screen.findByText(failure.response ? /Данные уже изменены/ : 'Нет связи');
  expect(screen.getByLabelText('Фактически: Тестовая услуга').value).toBe('5');
  if (failure.response) {
    expect(screen.getByText('Сохранить месяц')).toBeDisabled();
    expect(screen.getByText('Загрузить актуальные данные')).toBeInTheDocument();
  } else expect(screen.getByText('Сохранить месяц')).toBeEnabled();
});
test('late response for another month cannot replace current month', async () => {
  const pending = deferred();
  reporting.month.mockImplementation((_, month) => month === '2026-09' ? pending.promise : Promise.resolve(monthly({ month: '2026-10-01', items: [{ ...item, actual_monthly_count: 6 }] })));
  const view = render(<MonthlyServiceEditor {...props} />);
  view.rerender(<MonthlyServiceEditor {...props} month='2026-10' />);
  expect((await ready()).value).toBe('6');
  await act(async () => pending.resolve(monthly({ items: [{ ...item, actual_monthly_count: 1 }] })));
  expect(screen.getByLabelText('Фактически: Тестовая услуга').value).toBe('6');
});
test('late response for another child cannot replace the selected child', async () => {
  const pending = deferred();
  reporting.month.mockImplementation(id => id === 1 ? pending.promise : Promise.resolve(monthly({ items: [{ ...item, actual_monthly_count: 7 }] })));
  const view = render(<MonthlyServiceEditor {...props} />);
  view.rerender(<MonthlyServiceEditor {...props} studentId={2} />);
  expect((await ready()).value).toBe('7');
  await act(async () => pending.resolve(monthly()));
  expect(screen.getByLabelText('Фактически: Тестовая услуга').value).toBe('7');
});
test('copy into existing month requires confirmation and expected revision', async () => {
  reporting.transition.mockResolvedValue(monthly({ revision: 4 }));
  render(<MonthlyServiceEditor {...props} month='2027-01' />);
  await ready();
  fireEvent.click(screen.getByText('Взять назначения прошлого месяца'));
  expect(reporting.transition).not.toHaveBeenCalled();
  expect(screen.getByText(/Назначения за декабрь 2026/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Подтвердить'));
  await waitFor(() => expect(reporting.transition).toHaveBeenCalledWith(1, '2027-01', 'copy-previous', 3));
  await screen.findByText('Сохранено');
  expect(screen.getByLabelText('Фактически: Тестовая услуга').value).toBe('');
});
test('copy into absent month uses backend creation mode, not legacy writes', async () => {
  reporting.month.mockResolvedValue(null); reporting.create.mockResolvedValue(monthly());
  render(<MonthlyServiceEditor {...props} month='2027-01' />);
  await screen.findByText('Новый месяц');
  fireEvent.click(screen.getByText('Взять назначения прошлого месяца'));
  fireEvent.click(screen.getByText('Подтвердить'));
  await waitFor(() => expect(reporting.create).toHaveBeenCalledWith(1, '2027-01', expect.objectContaining({ mode: 'copy_previous' })));
});
test('legacy is migrated only by explicit confirmation into selected month', async () => {
  reporting.month.mockResolvedValue(null); reporting.legacy.mockResolvedValue([{ ...item, social_service: service, periodicity: 'курс' }]);
  reporting.create.mockResolvedValue(monthly());
  render(<MonthlyServiceEditor {...props} month='2027-01' />);
  await screen.findByText(/Создать набор за/);
  expect(reporting.create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText(/Создать набор за/));
  fireEvent.change(screen.getByLabelText('Максимум: Тестовая услуга'), { target: { value: '10' } });
  fireEvent.click(screen.getByText('Подтвердить'));
  await waitFor(() => expect(reporting.create).toHaveBeenCalledWith(1, '2027-01', expect.objectContaining({ mode: 'migrate_legacy', legacy_maximums: { 11: 10 } })));
  expect(reporting.create.mock.calls[0][2].include_legacy_actual).toBeUndefined();
});
test('finalize permits absent representative, locks edits, and reopens with fresh revision', async () => {
  reporting.month.mockResolvedValue(monthly({ items: [{ ...item, actual_monthly_count: 0 }] }));
  reporting.transition.mockResolvedValueOnce(monthly({ status: 'finalized', revision: 4, items: [{ ...item, actual_monthly_count: 0 }] })).mockResolvedValueOnce(monthly({ revision: 5 }));
  render(<MonthlyServiceEditor {...props} />);
  await ready();
  fireEvent.click(screen.getByText('Зафиксировать месяц'));
  fireEvent.click(screen.getByText('Подтвердить'));
  await screen.findByText('Месяц зафиксирован');
  expect(screen.getByLabelText('Фактически: Тестовая услуга')).toBeDisabled();
  fireEvent.click(screen.getByText('Открыть для изменений'));
  fireEvent.click(screen.getByText('Подтвердить'));
  await screen.findByText('Черновик');
  expect(reporting.transition).toHaveBeenLastCalledWith(1, '2026-09', 'reopen', 4);
});
test('archived snapshots remain visible and editable without renaming from directory', async () => {
  render(<MonthlyServiceEditor {...props} directory={[{ ...service, is_active: false, name: 'Новое название' }]} />);
  await ready();
  expect(screen.getByText(/Архивная услуга/)).toBeInTheDocument();
  expect(screen.queryByText('Новое название')).not.toBeInTheDocument();
});
test('failed reload is not presented as successfully refreshed old data', async () => {
  render(<MonthlyServiceEditor {...props} />); await ready();
  reporting.month.mockRejectedValue(new Error('Нет связи'));
  fireEvent.click(screen.getByText('Обновить'));
  await screen.findByText('Нет связи');
  expect(screen.queryByLabelText('Фактически: Тестовая услуга')).not.toBeInTheDocument();
});
