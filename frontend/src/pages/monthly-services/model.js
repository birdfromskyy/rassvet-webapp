/* global BigInt */
export const createRequestId = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
};
export const personName = person => person?.full_name || [person?.last_name, person?.first_name, person?.middle_name].filter(Boolean).join(' ');
export const monthLabel = value => new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric' }).format(new Date(`${value}-01T12:00:00`));
export const previousMonth = month => {
  const [year, number] = month.split('-').map(Number);
  return `${number === 1 ? year - 1 : year}-${String(number === 1 ? 12 : number - 1).padStart(2, '0')}`;
};
export const validMonth = value => /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) > 0 && Number(value.slice(0, 4)) < 9999;
export const rubles = n => {
  const value = BigInt(n);
  return `${new Intl.NumberFormat('ru').format(value / 100n)},${String(value % 100n).padStart(2, '0')}`;
};
export const priceInput = n => `${Math.floor(n / 100)},${String(n % 100).padStart(2, '0')}`;
export function kopecks(value) {
  const match = String(value).trim().match(/^(\d+)(?:[.,](\d{1,2}))?$/);
  if (!match) throw new Error('Укажите тариф в рублях, не более двух знаков после запятой');
  const result = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  if (!Number.isSafeInteger(result) || result > 100000000) throw new Error('Тариф должен быть от 0 до 1 000 000 ₽');
  return result;
}
export function integer(value, min, max, label) {
  const str = String(value).trim();
  const n = Number(str);
  if (!/^\d+$/.test(str) || !Number.isSafeInteger(n) || n < min || n > max) throw new Error(`${label}: целое число от ${min} до ${max}`);
  return n;
}
export function frequencyMaximum(text) {
  const match = String(text).trim().replace(/\s+/g, ' ').match(/^(\d+) (?:раз|раза) в (день|неделю|месяц)$/i);
  if (!match) return null;
  return Number(match[1]) * ({ день: 31, неделю: 4, месяц: 1 }[match[2].toLowerCase()]);
}
export const maximum = row => frequencyMaximum(row.periodicity) ?? row.maximum_monthly_count;
export const editRow = row => ({ ...row, tariff_rub: priceInput(row.tariff_kopecks), actual_monthly_count: row.actual_monthly_count ?? '', maximum_monthly_count: row.maximum_monthly_count ?? frequencyMaximum(row.periodicity) ?? '' });
export const newRow = service => editRow({ ...service, social_service_id: service.id, actual_monthly_count: null });
export function itemBody(row) {
  const max = integer(maximum(row), 0, 100000, 'Максимум');
  if (!row.periodicity.trim()) throw new Error('Укажите периодичность');
  if (frequencyMaximum(row.periodicity) === 0) throw new Error('Частота должна быть больше нуля');
  return {
    social_service_id: row.social_service_id,
    periodicity: row.periodicity.trim(),
    maximum_monthly_count: max,
    actual_monthly_count: row.actual_monthly_count === '' ? null : integer(row.actual_monthly_count, 0, max, 'Фактическое количество'),
    standard_duration_minutes: integer(row.standard_duration_minutes, 1, 1440, 'Стандартное время'),
    tariff_kopecks: kopecks(row.tariff_rub),
  };
}
export function totals(rows) {
  return rows.reduce((sum, row) => {
    if (row.actual_monthly_count === '') { sum.unfilled++; return sum; }
    try {
      const item = itemBody(row);
      sum.services += item.actual_monthly_count;
      sum.minutes += item.actual_monthly_count * item.standard_duration_minutes;
      sum.kopecks += BigInt(item.actual_monthly_count) * BigInt(item.tariff_kopecks);
    } catch { sum.invalid++; }
    return sum;
  }, { services: 0, minutes: 0, kopecks: 0n, unfilled: 0, invalid: 0 });
}
export const groups = rows => Object.entries(rows.reduce((result, row) => {
  const category = row.category || 'Категория не указана';
  (result[category] ||= []).push(row);
  return result;
}, {}));
export const matches = (row, query) => `${row.code} ${row.name} ${row.category}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'));
export const errorText = error => error.response?.status === 409
  ? 'Данные уже изменены. Ваш ввод сохранён на экране. Загрузите актуальные данные перед повторным сохранением.'
  : error.response?.data?.error || error.message || 'Не удалось выполнить запрос. Повторите попытку.';
export const personBody = value => ({ revision: value.identity_revision ?? value.revision ?? 0, last_name: value.last_name || '', first_name: value.first_name || '', middle_name: value.middle_name || '', birth_date: value.birth_date || null });
export const representativeAvailable = (rep, link, month) => {
  const [year, number] = month.split('-').map(Number);
  const end = `${month}-${new Date(year, number, 0).getDate()}`;
  return rep.is_active && link && (!link.valid_from || link.valid_from <= end) && (!link.valid_until || link.valid_until >= end);
};
