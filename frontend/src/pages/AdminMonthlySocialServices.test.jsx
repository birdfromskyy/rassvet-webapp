import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdminMonthlySocialServices from './AdminMonthlySocialServices';
import reporting from '../services/monthlyReportingService';
import scheduleService from '../services/scheduleService';
import socialServices from '../services/socialServiceReportService';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../hooks/useBrandFont', () => ({ default: () => {} }));
vi.mock('../services/monthlyReportingService', () => ({ __esModule: true, default: {
  students: vi.fn(), directory: vi.fn(), student: vi.fn(), links: vi.fn(), representatives: vi.fn(),
} }));
vi.mock('../services/scheduleService', () => ({ __esModule: true, default: { getStudentServiceValidities: vi.fn(), saveStudentServiceValidity: vi.fn() } }));
vi.mock('../services/socialServiceReportService', () => ({ __esModule: true, default: { getStudentServices: vi.fn(), selectStudentServices: vi.fn(), updateStudentService: vi.fn() } }));

const child = { id: 1, full_name: 'Иванов Иван Иванович', last_name: '', first_name: '', middle_name: '', is_active: true };
const directory = [{ id: 7, code: '1', category: 'Социально-бытовые', name: 'Помощь', periodicity: '2 раза в неделю', standard_duration_minutes: 30, tariff_kopecks: 10000, is_active: true }];

beforeEach(() => {
  vi.clearAllMocks();
  reporting.students.mockResolvedValue([child]); reporting.directory.mockResolvedValue(directory);
  socialServices.getStudentServices.mockResolvedValue([]); scheduleService.getStudentServiceValidities.mockResolvedValue([]);
  socialServices.selectStudentServices.mockResolvedValue([{ id: 11, social_service_id: 7, periodicity: '2 раза в неделю', maximum_monthly_count: 8, standard_duration_minutes: 30, tariff_kopecks: 10000, social_service: directory[0] }]);
});

async function chooseChild() {
  render(<AdminMonthlySocialServices />);
  await screen.findByLabelText('Ребёнок');
  fireEvent.mouseDown(screen.getByLabelText('Ребёнок'));
  fireEvent.click(screen.getByText('Иванов Иван Иванович'));
  await screen.findByText('ИППСУ ребёнка');
}

test('assigns IPPSU services without month or representative selection', async () => {
  await chooseChild();
  expect(screen.queryByLabelText('Месяц отчёта')).not.toBeInTheDocument();
  expect(screen.queryByText('Представитель в Акте')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Выбрать услуги'));
  const dialog = screen.getByRole('dialog', { name: 'Услуги по ИППСУ' });
  fireEvent.click(within(dialog).getByLabelText('Социально-бытовые'));
  fireEvent.click(within(dialog).getByText('Сохранить услуги (1)'));
  await waitFor(() => expect(socialServices.selectStudentServices).toHaveBeenCalledWith(1, [7]));
  expect(await screen.findByText('Услуги по ИППСУ сохранены')).toBeInTheDocument();
});

test('prefills structured child name from surname-first full name', async () => {
  reporting.student.mockResolvedValue(child); reporting.links.mockResolvedValue([]); reporting.representatives.mockResolvedValue([]);
  await chooseChild();
  fireEvent.click(screen.getByText('Карточка ребёнка и родителей'));
  expect(await screen.findByDisplayValue('Иванов')).toBeInTheDocument();
  expect(screen.getByDisplayValue('Иван')).toBeInTheDocument();
  expect(screen.getByDisplayValue('Иванович')).toBeInTheDocument();
});
