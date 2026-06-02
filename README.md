# معهد المستقبل التعليمي - دليل النشر

## هيكل المشروع

```
institute-app/
├── worker.js       ← الكود الرئيسي (Worker + API + HTML/CSS/JS)
├── schema.sql      ← جداول قاعدة البيانات + بيانات أولية
├── wrangler.toml   ← إعدادات Cloudflare
└── package.json    ← معلومات المشروع
```

## المتطلبات

1. **Node.js** (الإصدار 18 أو أحدث)
2. **حساب Cloudflare** (مجاني يكفي)
3. **Wrangler CLI** (`npm install -g wrangler`)

---

## خطوات النشر

### 1. تسجيل الدخول إلى Cloudflare

```bash
npx wrangler login
```

يتم توجيهك إلى المتصفح لتفعيل الوصول.

### 2. إنشاء قاعدة بيانات D1

```bash
npx wrangler d1 create institute-db
```

سيُظهر المعرّف (database_id). انسخه وضعه في `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "institute-db"
database_id = "أضع هنا المعرّف الذي ظهر لك"
```

### 3. إنشاء دلو R2 للتخزين

```bash
npx wrangler r2 bucket create institute-assets
```

### 4. تهيئة قاعدة البيانات (إنشاء الجداول + بيانات أولية)

```bash
# على البيئة المحلية (للتطوير)
npx wrangler d1 execute institute-db --local --file=./schema.sql

# على البيئة الحقيقية (بعد النشر)
npx wrangler d1 execute institute-db --remote --file=./schema.sql
```

### 5. نشر التطبيق

```bash
npx wrangler deploy
```

سيظهر لك رابط التطبيق مثل:
```
https://institute-app.your-subdomain.workers.dev
```

---

## الطلبات التجريبية

### حسابات الدخول:

| الاسم | كلمة المرور | الدور | الصف |
|-------|-------------|-------|------|
| أحمد محمد | 1234 | طالب | التاسع |
| سارة أحمد | 1234 | طالب | العاشر |
| admin | admin123 | مدير | - |

---

## واجهات API

### مصادقة
- `POST /api/login` - تسجيل دخول `{ username, password }`
- `POST /api/logout` - تسجيل خروج

### بيانات
- `GET /api/schedule?class=9th&day=السبت` - جدول الحصص
- `GET /api/grades?student_id=1` - درجات الطالب
- `GET /api/activities?summer=false` - الأنشطة (عام/صيفي)
- `GET /api/activities/my-registrations?student_id=1` - تسجيلاتي

### أنشطة
- `POST /api/activities/register` - تسجيل في نشاط `{ activity_id, student_id }`

### اختبارات
- `GET /api/exams?class=9th&student_id=1` - قائمة الاختبارات
- `GET /api/exam/1/questions` - أسئلة اختبار
- `POST /api/exam/submit` - تسليم اختبار `{ student_id, exam_id, answers[] }`

### إدارة (مدير)
- `POST /api/upload` - رفع صورة (multipart/form-data + header X-Admin-Key)
- `GET /api/images/:key` - جلب صورة من R2

---

## رفع صورة لنشاط (للمدير)

```bash
curl -X POST https://institute-app.xxx.workers.dev/api/upload \
  -H "X-Admin-Key: admin123" \
  -F "file=@photo.jpg"
```

سيُرجع `{ "key": "activities/1234567890-photo.jpg" }`.

ثم حدّث حقل `image_key` في جدول الأنشطة:

```bash
npx wrangler d1 execute institute-db --remote \
  --command="UPDATE activities SET image_key='activities/1234567890-photo.jpg' WHERE id=1"
```

---

## التطوير المحلي

```bash
# تشغيل محلي (مع D1 محلي)
npx wrangler dev

# يفتح على: http://localhost:8787
```

---

## ملاحظات أمنية للإنتاج

1. **غيّر JWT_SECRET** في `wrangler.toml` إلى مفتاح عشوائي قوي (32+ حرف)
2. **غيّر ADMIN_SECRET** إلى كلمة مرور قوية
3. **فعّل HTTPS** (مُفعّل تلقائياً على Cloudflare Workers)
4. أضف مصادقة أكثر قوة عند الحاجة (Rate limiting, إلخ)
