-- ============================================================
-- معهد المستقبل التعليمي - D1 Database Schema
-- ============================================================
-- ملاحظة: انسخ هذا الملف وشغّله عبر:
--   npx wrangler d1 execute institute-db --remote --file=./schema.sql
-- ============================================================

-- جدول الطلاب
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  class TEXT NOT NULL,
  password TEXT NOT NULL
);

-- جدول المعلمين
CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subject TEXT NOT NULL
);

-- جدول الجدول الدراسي الأسبوعي
CREATE TABLE IF NOT EXISTS schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,          -- السبت، الأحد، ... الخميس
  period INTEGER NOT NULL,     -- رقم الحصة (1-7)
  class TEXT NOT NULL,         -- الصف (9th, 10th)
  subject TEXT NOT NULL,
  teacher_id INTEGER,
  room TEXT,
  online_link TEXT
);

-- جدول الدرجات
CREATE TABLE IF NOT EXISTS grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  exam_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL DEFAULT 100,
  date TEXT
);

-- جدول الأنشطة والنوادي
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT,
  image_key TEXT,
  is_summer BOOLEAN DEFAULT 0,
  max_capacity INTEGER DEFAULT 30
);

-- جدول تسجيلات الأنشطة
CREATE TABLE IF NOT EXISTS activity_registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  registered_at TEXT DEFAULT (datetime('now'))
);

-- جدول الاختبارات (الأسئلة بصيغة JSON)
CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  class TEXT NOT NULL,
  time_limit INTEGER NOT NULL DEFAULT 300, -- بالثواني
  questions TEXT NOT NULL                  -- JSON array
);

-- جدول محاولات الاختبارات
CREATE TABLE IF NOT EXISTS exam_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  exam_id INTEGER NOT NULL,
  score INTEGER NOT NULL,
  answers TEXT,           -- JSON array
  completed_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- البيانات الأولية (Seed Data)
-- ============================================================

-- المعلمين
INSERT INTO teachers (name, subject) VALUES
  ('أ. محمد علي', 'رياضيات'),
  ('أ. فاطمة حسن', 'علوم'),
  ('أ. خالد عبدالله', 'لغة عربية'),
  ('أ. ليلى عمر', 'لغة إنجليزية'),
  ('أ. سامي يوسف', 'تاريخ');

-- الطلاب
INSERT INTO students (name, class, password) VALUES
  ('أحمد محمد', '9th', '1234'),
  ('سارة أحمد', '10th', '1234');

-- جدول الحصص - الصف التاسع
INSERT INTO schedule (day, period, class, subject, teacher_id, room, online_link) VALUES
  ('السبت', 1, '9th', 'رياضيات', 1, 'قاعة 101', NULL),
  ('السبت', 2, '9th', 'علوم', 2, 'مختبر 5', NULL),
  ('السبت', 3, '9th', 'لغة عربية', 3, 'قاعة 101', NULL),
  ('السبت', 4, '9th', 'لغة إنجليزية', 4, 'قاعة 102', NULL),
  ('السبت', 5, '9th', 'تاريخ', 5, 'قاعة 101', NULL),
  ('السبت', 6, '9th', 'رياضيات', 1, 'قاعة 101', NULL),
  ('الأحد', 1, '9th', 'لغة إنجليزية', 4, 'قاعة 102', NULL),
  ('الأحد', 2, '9th', 'رياضيات', 1, 'قاعة 101', NULL),
  ('الأحد', 3, '9th', 'علوم', 2, 'مختبر 5', 'https://meet.example.com/science'),
  ('الأحد', 4, '9th', 'لغة عربية', 3, 'قاعة 101', NULL),
  ('الأحد', 5, '9th', 'تاريخ', 5, 'قاعة 101', NULL),
  ('الأحد', 6, '9th', 'لغة إنجليزية', 4, 'قاعة 102', NULL),
  ('الإثنين', 1, '9th', 'علوم', 2, 'مختبر 5', NULL),
  ('الإثنين', 2, '9th', 'لغة عربية', 3, 'قاعة 101', NULL),
  ('الإثنين', 3, '9th', 'رياضيات', 1, 'قاعة 101', NULL),
  ('الإثنين', 4, '9th', 'لغة إنجليزية', 4, 'قاعة 102', NULL),
  ('الإثنين', 5, '9th', 'تاريخ', 5, 'قاعة 101', NULL),
  ('الثلاثاء', 1, '9th', 'رياضيات', 1, 'قاعة 101', NULL),
  ('الثلاثاء', 2, '9th', 'علوم', 2, 'مختبر 5', NULL),
  ('الثلاثاء', 3, '9th', 'لغة عربية', 3, 'قاعة 101', NULL),
  ('الثلاثاء', 4, 'لغة إنجليزية', 4, 'قاعة 102', 'https://meet.example.com/english'),
  ('الأربعاء', 1, '9th', 'تاريخ', 5, 'قاعة 101', NULL),
  ('الأربعاء', 2, '9th', 'رياضيات', 1, 'قاعة 101', NULL),
  ('الأربعاء', 3, '9th', 'لغة إنجليزية', 4, 'قاعة 102', NULL),
  ('الأربعاء', 4, '9th', 'علوم', 2, 'مختبر 5', NULL);

-- جدول الحصص - الصف العاشر
INSERT INTO schedule (day, period, class, subject, teacher_id, room, online_link) VALUES
  ('السبت', 1, '10th', 'رياضيات', 1, 'قاعة 201', NULL),
  ('السبت', 2, '10th', 'لغة عربية', 3, 'قاعة 201', NULL),
  ('السبت', 3, '10th', 'علوم', 2, 'مختبر 6', NULL),
  ('السبت', 4, '10th', 'لغة إنجليزية', 4, 'قاعة 202', NULL),
  ('السبت', 5, '10th', 'تاريخ', 5, 'قاعة 201', NULL),
  ('الأحد', 1, '10th', 'لغة إنجليزية', 4, 'قاعة 202', NULL),
  ('الأحد', 2, '10th', 'رياضيات', 1, 'قاعة 201', NULL),
  ('الأحد', 3, '10th', 'لغة عربية', 3, 'قاعة 201', NULL),
  ('الأحد', 4, '10th', 'علوم', 2, 'مختبر 6', NULL),
  ('الأحد', 5, '10th', 'تاريخ', 5, 'قاعة 201', NULL),
  ('الإثنين', 1, '10th', 'رياضيات', 1, 'قاعة 201', NULL),
  ('الإثنين', 2, '10th', 'علوم', 2, 'مختبر 6', NULL),
  ('الإثنين', 3, '10th', 'لغة إنجليزية', 4, 'قاعة 202', NULL),
  ('الإثنين', 4, '10th', 'لغة عربية', 3, 'قاعة 201', NULL),
  ('الثلاثاء', 1, '10th', 'لغة عربية', 3, 'قاعة 201', NULL),
  ('الثلاثاء', 2, '10th', 'رياضيات', 1, 'قاعة 201', NULL),
  ('الثلاثاء', 3, '10th', 'علوم', 2, 'مختبر 6', NULL),
  ('الأربعاء', 1, '10th', 'تاريخ', 5, 'قاعة 201', NULL),
  ('الأربعاء', 2, '10th', 'لغة إنجليزية', 4, 'قاعة 202', NULL),
  ('الأربعاء', 3, '10th', 'رياضيات', 1, 'قاعة 201', NULL);

-- درجات أحمد (الصف التاسع)
INSERT INTO grades (student_id, subject, exam_name, score, max_score, date) VALUES
  (1, 'رياضيات', 'اختبار نصفي', 85, 100, '2025-11-15'),
  (1, 'رياضيات', 'اختبار نهائي', 90, 100, '2026-03-10'),
  (1, 'علوم', 'اختبار نصفي', 78, 100, '2025-11-18'),
  (1, 'علوم', 'اختبار عملي', 82, 100, '2026-02-20'),
  (1, 'لغة عربية', 'اختبار نصفي', 92, 100, '2025-11-20'),
  (1, 'لغة عربية', 'مقال إبداعي', 88, 100, '2026-01-15'),
  (1, 'لغة إنجليزية', 'اختبار نصفي', 88, 100, '2025-11-22'),
  (1, 'تاريخ', 'اختبار نصفي', 75, 100, '2025-11-25');

-- درجات سارة (الصف العاشر)
INSERT INTO grades (student_id, subject, exam_name, score, max_score, date) VALUES
  (2, 'رياضيات', 'اختبار نصفي', 95, 100, '2025-11-15'),
  (2, 'رياضيات', 'اختبار نهائي', 92, 100, '2026-03-10'),
  (2, 'علوم', 'اختبار نصفي', 88, 100, '2025-11-18'),
  (2, 'علوم', 'اختبار عملي', 90, 100, '2026-02-20'),
  (2, 'لغة عربية', 'اختبار نصفي', 80, 100, '2025-11-20'),
  (2, 'لغة عربية', 'مقال إبداعي', 85, 100, '2026-01-15'),
  (2, 'لغة إنجليزية', 'اختبار نصفي', 92, 100, '2025-11-22'),
  (2, 'تاريخ', 'اختبار نصفي', 88, 100, '2025-11-25');

-- الأنشطة العامة
INSERT INTO activities (title, description, date, image_key, is_summer, max_capacity) VALUES
  ('نادي الروبوتات', 'تعلم أساسيات البرمجة والروبوتات مع نخبة من المبرمجين المحترفين. نشاط أسبوعي كل يوم سبت.', '2026-06-01', 'activity-robots.jpg', 0, 25),
  ('نادي الرسم والإبداع', 'طور مهاراتك الفنية في الرسم والتلوين والخط العربي مع فنانين محترفين.', '2026-06-05', 'activity-art.jpg', 0, 20);

-- الأنشطة الصيفية
INSERT INTO activities (title, description, date, image_key, is_summer, max_capacity) VALUES
  ('المخيم الصيفي التقني', 'مخيم صيفي لمدة أسبوع يتضمن ورش عمل في البرمجة والتصميم والذكاء الاصطناعي.', '2026-07-15', 'activity-camp.jpg', 1, 40),
  ('دورة تطوير تطبيقات الموبايل', 'تعلم كيفية بناء تطبيقات موبايل حقيقية باستخدام تقنيات الويب الحديثة خلال 4 أسابيع.', '2026-07-20', 'activity-mobile.jpg', 1, 30);

-- تسجيلات مسبقة (أحمد مسجل في نادي الروبوتات)
INSERT INTO activity_registrations (activity_id, student_id, registered_at) VALUES
  (1, 1, '2026-05-28 10:30:00');

-- الاختبارات
INSERT INTO exams (title, class, time_limit, questions) VALUES
  (
    'اختبار الرياضيات - الصف التاسع', '9th', 300,
    '[{"q":"ما ناتج 15 × 7؟","options":["95","105","115","125"],"answer":1},{"q":"ما هي قيمة جذر 144؟","options":["11","12","13","14"],"answer":1},{"q":"إذا كان x + 8 = 15، فما قيمة x؟","options":["5","6","7","8"],"answer":2},{"q":"ما مساحة مستطيل طوله 8 وعرضه 5؟","options":["30","35","40","45"],"answer":2}]'
  ),
  (
    'اختبار العلوم - الصف العاشر', '10th', 300,
    '[{"q":"ما هو رمز العنصر الكيميائي الأكسجين؟","options":["Ox","O","Og","Os"],"answer":1},{"q":"ما هي وحدة قياس القوة؟","options":["جول","واط","نيوتن","باسكال"],"answer":2},{"q":"كم عدد كواكب المجموعة الشمسية؟","options":["7","8","9","10"],"answer":1},{"q":"ما هي أصغر وحدة بناء في الكائن الحي؟","options":["الذرة","الجزيء","الخلية","النسيج"],"answer":2}]'
  ),
  (
    'اختبار اللغة العربية - الصف التاسع', '9th', 300,
    '[{"q":"ما هو جمع كلمة \"كتاب\"؟","options":["كتابات","كتب","كتُب","كتائب"],"answer":2},{"q":"ما نوع الفعل \"كتب\"؟","options":["فعل ماض","فعل مضارع","فعل أمر","اسم فعل"],"answer":0},{"q":"ما إعراب كلمة \"الطالبُ\" في الجملة: جاء الطالبُ؟","options":["مفعول به","فاعل مرفوع","مبتدأ","خبر"],"answer":1},{"q":"ما هو الضد الصحيح لكلمة \"الشجاعة\"؟","options":["الكرم","الجُبن","الحزن","الضعف"],"answer":1}]'
  );
