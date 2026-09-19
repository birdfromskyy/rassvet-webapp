-- UserStudent is the single source of truth for parent-child relationships.
-- Reporting profiles only add document fields and are never an independent
-- way to attach a parent to a child.
DO $$
BEGIN
 IF to_regclass('user_students') IS NOT NULL THEN
  INSERT INTO legal_representatives(user_id,last_name,first_name,middle_name,is_active,revision)
  SELECT DISTINCT u.id,u.last_name,u.first_name,u.middle_name,true,1
  FROM users u JOIN user_students us ON us.user_id=u.id
  WHERE u.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM legal_representatives r WHERE r.user_id=u.id);

  INSERT INTO student_legal_representatives(student_id,legal_representative_id,relationship,revision)
  SELECT us.student_id,r.id,'законный представитель',1
  FROM user_students us JOIN legal_representatives r ON r.user_id=us.user_id
  WHERE NOT EXISTS (
   SELECT 1 FROM student_legal_representatives l
   WHERE l.student_id=us.student_id AND l.legal_representative_id=r.id
  );
 END IF;
END $$;

-- One reporting profile per account prevents duplicate choices in documents.
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_representatives_user_unique
 ON legal_representatives(user_id) WHERE user_id IS NOT NULL;
