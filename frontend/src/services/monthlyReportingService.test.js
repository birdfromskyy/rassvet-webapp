import api from './api';
import reporting from './monthlyReportingService';
vi.mock('./api', () => ({ __esModule: true, default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());
test('month URLs include the first day and year', async () => {
  api.get.mockResolvedValue({ data: { month: { revision: 2 } } });
  expect(await reporting.month(7, '2027-01')).toEqual({ revision: 2 });
  expect(api.get).toHaveBeenCalledWith('/admin/students/7/service-months/2027-01-01', { signal: undefined });
});
test('only not-found means an absent month', async () => {
  api.get.mockRejectedValueOnce({ response: { status: 404 } }).mockRejectedValueOnce({ response: { status: 500 } });
  expect(await reporting.month(7, '2027-01')).toBeNull();
  await expect(reporting.month(7, '2027-01')).rejects.toEqual({ response: { status: 500 } });
});
test('legacy cutover response is handled without hiding other errors', async () => {
  api.get.mockRejectedValueOnce({ response: { status: 409, data: { code: 'monthly_reporting_required' } } }).mockRejectedValueOnce({ response: { status: 409, data: {} } });
  expect(await reporting.legacy(7)).toEqual([]);
  await expect(reporting.legacy(7)).rejects.toBeDefined();
});
test('representatives and links are fetched beyond the first 100 entries', async () => {
  api.get.mockResolvedValueOnce({ data: { representatives: Array.from({ length: 100 }, (_, id) => ({ id })) } }).mockResolvedValueOnce({ data: { representatives: [{ id: 100 }] } });
  expect(await reporting.representatives()).toHaveLength(101);
  expect(api.get.mock.calls[1][1].params.offset).toBe(100);
});
test('student options include archived and inactive people without duplicate IDs', async () => {
  api.get.mockResolvedValueOnce({ data: { students: [{ id: 1, full_name: 'Тестов', is_active: false }] } }).mockResolvedValueOnce({ data: { students: [{ id: 2, full_name: 'Архивов', archived_at: '2026-01-01' }] } });
  expect((await reporting.students()).map(row => row.id)).toEqual([2, 1]);
  expect(api.get.mock.calls[1][1].params.archived).toBe(true);
});
test('revision and nullable facts reach the monthly API unchanged', async () => {
  api.put.mockResolvedValue({ data: { month: { revision: 5 } } });
  const body = { revision: 4, representative_id: null, items: [{ social_service_id: 1, actual_monthly_count: null }, { social_service_id: 2, actual_monthly_count: 0 }] };
  await reporting.save(7, '2027-01', body);
  expect(api.put).toHaveBeenCalledWith('/admin/students/7/service-months/2027-01-01', body);
});
