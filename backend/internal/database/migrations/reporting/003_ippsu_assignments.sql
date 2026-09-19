-- IPPSU services are a current assignment for a child, not a separate copy
-- for every reporting month. Monthly tables remain as read-only history for
-- installations that already tested the former workflow.
DROP TRIGGER IF EXISTS legacy_student_services_readonly ON student_social_services;
DROP FUNCTION IF EXISTS guard_legacy_student_services();

-- Existing names consistently use "Фамилия Имя Отчество". Populate only
-- missing structured fields and never overwrite administrator corrections.
UPDATE students
SET last_name = split_part(btrim(full_name), ' ', 1),
    first_name = split_part(btrim(full_name), ' ', 2),
    middle_name = CASE
      WHEN cardinality(regexp_split_to_array(btrim(full_name), E'\\s+')) > 2
      THEN array_to_string((regexp_split_to_array(btrim(full_name), E'\\s+'))[3:], ' ')
      ELSE ''
    END
WHERE btrim(last_name) = ''
  AND btrim(first_name) = ''
  AND cardinality(regexp_split_to_array(btrim(full_name), E'\\s+')) >= 2;

-- Preserve service choices made during the monthly prototype by restoring
-- the newest known snapshot as the current IPPSU assignment. Existing current
-- assignments always win.
WITH latest_month AS (
  SELECT DISTINCT ON (student_id) id, student_id
  FROM student_service_months
  ORDER BY student_id, month DESC, revision DESC
)
INSERT INTO student_social_services (
  student_id, social_service_id, periodicity, maximum_monthly_count,
  actual_monthly_count, standard_duration_minutes, tariff_kopecks,
  created_at, updated_at
)
SELECT lm.student_id, i.social_service_id, i.periodicity,
       i.maximum_monthly_count, 0, i.standard_duration_minutes,
       i.tariff_kopecks, now(), now()
FROM latest_month lm
JOIN student_service_month_items i ON i.month_id = lm.id
ON CONFLICT (student_id, social_service_id) DO NOTHING;
