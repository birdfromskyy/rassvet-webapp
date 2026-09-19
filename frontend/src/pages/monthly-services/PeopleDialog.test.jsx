import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PeopleDialog from './PeopleDialog';
import reporting from '../../services/monthlyReportingService';

vi.mock('../../services/monthlyReportingService', () => ({ __esModule: true, default: { identity: vi.fn(), saveRepresentative: vi.fn() } }));

const student = { id: 1, full_name: 'Тестов Иван', last_name: 'Тестов', first_name: 'Иван', middle_name: '', birth_date: null, identity_revision: 4 };
const props = { student, representatives: [], links: [], onSaved: vi.fn(), onClose: vi.fn() };

beforeEach(() => vi.resetAllMocks());

test('saves edited child from one clear save action', async () => {
  reporting.identity.mockResolvedValue({ ...student, birth_date: '2016-02-29', identity_revision: 5 });
  render(<PeopleDialog {...props} />);
  fireEvent.change(screen.getByLabelText('Дата рождения'), { target: { value: '2016-02-29' } });
  fireEvent.click(screen.getByText('Сохранить'));
  await waitFor(() => expect(reporting.identity).toHaveBeenCalledWith(1, { revision: 4, last_name: 'Тестов', first_name: 'Иван', middle_name: '', birth_date: '2016-02-29' }));
  expect(props.onClose).toHaveBeenCalled();
});

test('cancel closes without a browser confirmation', () => {
  const confirm = vi.spyOn(window, 'confirm');
  render(<PeopleDialog {...props} />);
  fireEvent.change(screen.getByLabelText(/Фамилия/), { target: { value: 'Изменено' } });
  fireEvent.click(screen.getByText('Отмена'));
  expect(confirm).not.toHaveBeenCalled();
  expect(props.onClose).toHaveBeenCalled();
  confirm.mockRestore();
});

test('only the parent linked through the account relation is editable', () => {
  const linked = { id: 8, user_id: 12, last_name: 'Тестова', first_name: 'Анна', revision: 1, is_active: true };
  const unrelated = { id: 9, user_id: 13, last_name: 'Чужая', first_name: 'Анна', revision: 1, is_active: true };
  render(<PeopleDialog {...props} representatives={[linked, unrelated]} links={[{ legal_representative_id: 8 }]} />);
  expect(screen.getByDisplayValue('Тестова')).toBeInTheDocument();
  expect(screen.queryByDisplayValue('Чужая')).not.toBeInTheDocument();
});
