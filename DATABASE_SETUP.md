# تعليمات إنشاء قاعدة البيانات المحلية

## الخطوة 1: إنشاء قاعدة البيانات

يرجى فتح **pgAdmin 4** أو **SQL Shell (psql)** من قائمة Start وتنفيذ الأمر التالي:

```sql
CREATE DATABASE meter_reader;
```

**أو** يمكنك استخدام pgAdmin:
1. افتح pgAdmin 4
2. اتصل بـ PostgreSQL Server (localhost)
3. انقر بزر الماوس الأيمن على "Databases"
4. اختر "Create" > "Database"
5. اكتب الاسم: `meter_reader`
6. اضغط "Save"

## الخطوة 2: التحقق من كلمة المرور

ملف `.env` تم تحديثه ليستخدم:
- **Username:** `postgres`
- **Password:** `postgres`
- **Host:** `localhost`
- **Port:** `5432`
- **Database:** `meter_reader`

**إذا كانت كلمة مرور PostgreSQL لديك مختلفة**، يرجى تحديث ملف `.env` بكلمة المرور الصحيحة.

## الخطوة 3: تطبيق الـ Schema

بعد إنشاء قاعدة البيانات، سأقوم بتشغيل الأمر التالي لإنشاء الجداول:

```bash
npm run db:push
```
