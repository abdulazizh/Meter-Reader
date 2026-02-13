# إضافة PostgreSQL إلى PATH في Windows

## الطريقة السريعة (عبر PowerShell)

افتح PowerShell كمسؤول وقم بتشغيل الأمر التالي:

```powershell
# ابحث عن مجلد PostgreSQL (عادة يكون في Program Files)
$pgPath = "C:\Program Files\PostgreSQL\17\bin"

# أضف المسار إلى PATH
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$pgPath", [EnvironmentVariableTarget]::Machine)

# أعد تحميل المتغيرات
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

**ملاحظة:** قد تحتاج إلى إعادة فتح PowerShell بعد ذلك.

---

## الطريقة اليدوية (عبر واجهة Windows)

### الخطوة 1: ابحث عن مجلد PostgreSQL bin
المسار الافتراضي عادة:
```
C:\Program Files\PostgreSQL\17\bin
```

### الخطوة 2: افتح إعدادات متغيرات البيئة
1. اضغط `Win + R`
2. اكتب: `sysdm.cpl` واضغط Enter
3. اذهب إلى تبويب **Advanced**
4. اضغط على **Environment Variables**

### الخطوة 3: أضف المسار
1. في قسم **System variables** (أو User variables)
2. ابحث عن متغير **Path**
3. اضغط **Edit**
4. اضغط **New**
5. أضف المسار: `C:\Program Files\PostgreSQL\17\bin`
6. اضغط **OK** على جميع النوافذ

### الخطوة 4: تحقق من الإضافة
أعد فتح PowerShell واكتب:
```powershell
psql --version
```

يجب أن ترى: `psql (PostgreSQL) 17.x`

---

## بديل: استخدام المسار الكامل مباشرة

إذا كنت لا تريد تعديل PATH، يمكنك استخدام المسار الكامل:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" --version
```
