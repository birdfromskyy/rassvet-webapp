import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdminStaffDates, { sortStaff } from './AdminStaffDates';
import service from '../services/staffEventsService';
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../hooks/useBrandFont', () => ({ default: () => {} }));
vi.mock('../services/staffEventsService', () => ({ __esModule: true, default: { list: vi.fn(), recipients: vi.fn(), save: vi.fn(), configure: vi.fn() } }));
const staff = [
  { kind: 'teacher', owner_id: 1, name: 'Тестов Иван', role: 'teacher', active: true, medical_days: 20, birthday_days: 2, next_birthday: '2026-09-20', dates: { revision: 2, birth_date: '1980-09-20', medical_until: '2026-10-08' } },
  { kind: 'user', owner_id: 2, name: 'Тестова Анна', role: 'admin', active: true, medical_days: null, birthday_days: null, dates: {} },
];
beforeEach(() => { vi.resetAllMocks(); service.list.mockResolvedValue({ staff, reminder_hour: 9 }); service.recipients.mockResolvedValue([{ id: 7, profile_url: 'https://vk.com/id700', enabled: true, medical: false, birthdays: false, revision: 0 }]); });
test('sorts unknown dates last and closest birthdays first', () => {
  expect(sortStaff([{ ...staff[0], birthday_days: 50 }, staff[1], { ...staff[0], owner_id: 3, birthday_days: 0 }], 1, 1).map(row => row.owner_id)).toEqual([3, 1, 2]);
  expect(sortStaff([{ ...staff[0], medical_days: -3 }, staff[1], { ...staff[0], owner_id: 3, medical_days: 20 }], 0, -1).map(row => row.owner_id)).toEqual([3, 1, 2]);
});
test('edits both private dates using the read revision', async () => {
  service.save.mockResolvedValue({ revision: 3 });
  render(<AdminStaffDates />); await screen.findByText('Тестов Иван');
  fireEvent.click(within(screen.getByText('Тестов Иван').closest('tr')).getByText('Изменить'));
  expect(screen.getByLabelText('Дата рождения').value).toBe('1980-09-20');
  expect(screen.getByLabelText('Медосмотр действителен до').value).toBe('2026-10-08');
  fireEvent.change(screen.getByLabelText('Медосмотр действителен до'), { target: { value: '2027-01-01' } });
  fireEvent.click(screen.getByText('Сохранить'));
  await waitFor(() => expect(service.save).toHaveBeenCalledWith('teacher', 1, { revision: 2, birth_date: '1980-09-20', medical_until: '2027-01-01' }));
});
test('a conflict keeps edited dates in the modal', async () => {
  service.save.mockRejectedValue({ response: { status: 409 } });
  render(<AdminStaffDates />); await screen.findByText('Тестов Иван');
  fireEvent.click(within(screen.getByText('Тестов Иван').closest('tr')).getByText('Изменить'));
  fireEvent.change(screen.getByLabelText('Дата рождения'), { target: { value: '1980-10-01' } });
  fireEvent.click(screen.getByText('Сохранить'));
  await screen.findByText(/Запись уже изменена/);
  expect(screen.getByLabelText('Дата рождения').value).toBe('1980-10-01');
});
test('birthday recipients are opt-in separately from medical reminders', async () => {
  service.configure.mockResolvedValue({ revision: 1 });
  render(<AdminStaffDates />); await screen.findByText('Тестов Иван');
  fireEvent.click(screen.getByRole('tab', { name: 'Получатели VK' }));
  fireEvent.click(screen.getByText('Настроить'));
  const birthday = screen.getByLabelText('Получать напоминания о днях рождения сотрудников');
  expect(birthday).not.toBeChecked(); fireEvent.click(birthday);
  fireEvent.click(screen.getByText('Сохранить'));
  await waitFor(() => expect(service.configure).toHaveBeenCalledWith(7, { revision: 0, medical: false, birthdays: true }));
});
test('closing an unchanged dialog does not ask for confirmation', async () => {
  const confirm = vi.spyOn(window, 'confirm');
  render(<AdminStaffDates />); await screen.findByText('Тестов Иван');
  fireEvent.click(within(screen.getByText('Тестов Иван').closest('tr')).getByText('Изменить'));
  fireEvent.click(screen.getByText('Отмена'));
  expect(confirm).not.toHaveBeenCalled();
  confirm.mockRestore();
});
