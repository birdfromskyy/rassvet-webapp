import { editRow, frequencyMaximum, itemBody, kopecks, previousMonth, representativeAvailable, rubles, totals, validMonth } from './model';

const row = () => editRow({ social_service_id: 1, periodicity: '2 раза в неделю', standard_duration_minutes: 30, tariff_kopecks: 35571, maximum_monthly_count: 8, actual_monthly_count: null });
test('calendar months include year and cross December correctly', () => {
  expect(previousMonth('2027-01')).toBe('2026-12');
  expect(previousMonth('2026-09')).toBe('2026-08');
  expect(validMonth('2026-13')).toBe(false);
  expect(validMonth('0000-01')).toBe(false);
});
test.each([['2 раза в неделю', 8], ['3 раза в неделю', 12], ['2 раза в день', 62], ['3 раза в месяц', 3], [' По назначению врача 2 ', null], ['1 по ИППСУ', null]])('frequency %s → %s', (text, expected) => expect(frequencyMaximum(text)).toBe(expected));
test('unknown frequency requires an explicit maximum; facts preserve null and zero', () => {
  expect(itemBody(row()).actual_monthly_count).toBeNull();
  expect(itemBody({ ...row(), actual_monthly_count: '0' }).actual_monthly_count).toBe(0);
  expect(() => itemBody({ ...row(), periodicity: 'по назначению врача', maximum_monthly_count: '' })).toThrow('Максимум');
  expect(() => itemBody({ ...row(), actual_monthly_count: '9' })).toThrow();
  expect(() => itemBody({ ...row(), actual_monthly_count: '1.5' })).toThrow();
  expect(itemBody({ ...row(), periodicity: 'курс', maximum_monthly_count: '10' }).maximum_monthly_count).toBe(10);
});
test('money is parsed as integer cents, without silent rounding', () => {
  expect(kopecks('355,71')).toBe(35571);
  expect(kopecks('0.01')).toBe(1);
  expect(kopecks('17')).toBe(1700);
  expect(() => kopecks('1.999')).toThrow();
  expect(() => kopecks('-1')).toThrow();
  expect(() => kopecks('')).toThrow();
  expect(rubles(35571n)).toBe('355,71');
});
test('totals count unfilled separately and never lose cents in large sums', () => {
  expect(totals([row(), { ...row(), actual_monthly_count: '0' }, { ...row(), actual_monthly_count: '2' }])).toEqual({ unfilled: 1, invalid: 0, services: 2, minutes: 60, kopecks: 71142n });
  const large = { ...row(), periodicity: '100000 раз в месяц', actual_monthly_count: '100000', tariff_rub: '999999,99' };
  expect(totals(Array(1000).fill(large)).kopecks).toBe(9999999900000000n);
});
test('representatives must be active at the end of the selected month', () => {
  expect(representativeAvailable({ is_active: true }, { valid_until: '2026-12-31' }, '2027-01')).toBe(false);
  expect(representativeAvailable({ is_active: true }, { valid_until: '2028-02-29' }, '2028-02')).toBe(true);
  expect(representativeAvailable({ is_active: false }, {}, '2028-02')).toBe(false);
});
