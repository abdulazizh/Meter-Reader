# دليل نشر تطبيق "قراءات المشتركين" على خادم VPS (Ubuntu / Debian)

يشرح هذا الدليل الخطوات التفصيلية لنشر واستضافة الخادم الخلفي (Backend) ولوحة التحكم الخاصة بتطبيق **"قراءات المشتركين"** من **GitHub** إلى خادم **VPS** يعتمد نظام Ubuntu أو Debian.

---

## 📋 المتطلبات الأساسية

1. **خادم VPS**: بنظام Ubuntu (20.04 / 22.04 / 24.04) أو Debian.
2. **صلاحيات SSH**: اسم المستخدم (`root` أو مستخدم بصلحيات `sudo`) وعنوان الـ IP.
3. **قاعدة بيانات PostgreSQL**: سواء كانت مثبتة على نفس الخادم أو قاعدة بيانات سحابية (مثل Supabase أو Render).
4. **اسم نطاق (Domain Name)**: مربوط بعنوان الـ IP الخاص بالخادم (توصى به لتفعيل شهادة الأمان HTTPS).

---

## 🚀 خطوات النشر

### الخطوة 1: التحديث وتثبيت البيئة الأساسية على الخادم

قم بالاتصال بالـ VPS عبر terminal باستخدام أمر SSH:

```bash
ssh root@YOUR_SERVER_IP
```

ثم قم بتنفيذ الأوامر التالية لتحديث النظام وتثبيت Node.js و Git و Nginx و PM2:

```bash
# 1. تحديث النظام
sudo apt update && sudo apt upgrade -y

# 2. تثبيت Git و curl و Nginx
sudo apt install -y git curl nginx

# 3. تثبيت Node.js (الإصدار 20 LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 4. تثبيت PM2 لإدارة تشغيل التطبيق في الخلفية
sudo npm install -g pm2
```

---

### الخطوة 2: استنساخ المشروع من GitHub وتثبيت المكتبات

```bash
# 1. الانتقال إلى مجلد التطبيقات
cd /var/www

# 2. سحب المشروع من GitHub (استبدل الرابط برابط مستودعك الخاص)
sudo git clone https://github.com/abdulazizh/Meter-Reader.git meter
cd meter

# 3. تعديل صلاحيات المجلد للمستخدم الحالي
sudo chown -R $USER:$USER /var/www/meter

# 4. تثبيت المكتبات الحزم
npm install
```

---

### الخطوة 3: إعداد ملف المتغيرات البيئية (`.env`)

قم بإنشاء وتعديل ملف `.env` داخل مجلد المشروع:

```bash
nano .env
```

قم بوضع المتغيرات البيئية الخاصة بك داخل الملف:

```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE_NAME
DIRECT_URL=postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE_NAME
SESSION_SECRET=a_very_secret_random_string_here_12345
EXPO_PUBLIC_DOMAIN=your-domain.com
```

> [!TIP]
> احفظ الملف في محرر `nano` بالضغط على `Ctrl + O` ثم `Enter` وللخروج اضغط `Ctrl + X`.

---

### الخطوة 4: بناء التطبيق وتحديث قاعدة البيانات

```bash
# 1. بناء ملفات خادم التطبيق
npm run server:build

# 2. رفع وتحديث جداول قاعدة البيانات عبر Drizzle ORM
npm run db:push
```

---

### الخطوة 5: تشغيل التطبيق عبر PM2 (في الخلفية)

ضمان تشغيل السيرفر بشكل دائم وإعادة تشغيله تلقائيًا عند إعادة تشغيل الـ VPS:

```bash
# 1. تشغيل التطبيق
pm2 start server_dist/index.js --name "meter"

# 2. حفظ حالة PM2 وإعداد التشغيل التلقائي عند إقلاع النظام
pm2 save
pm2 startup
```

> [!NOTE]
> عند تنفيذ أمر `pm2 startup` سيظهر لك أمر في الشاشة قم بنسخه وتنفيده في التيرمينال لتفعيل الخدمة تلقائياً عند الإقلاع.

---

### الخطوة 6: إعداد Nginx كـ Reverse Proxy

قم بإنشاء ملف تكوين جديد لـ Nginx:

```bash
sudo nano /etc/nginx/sites-available/meter
```

ضع التكوين التالي داخل الملف (مع استبدال `your-domain.com` بنطاقك أو عنوان IP الخادم):

```nginx
server {
    listen 80;
    server_name your-domain.com; # أو ضع عنوان IP الخاص بك

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

قم بتفعيل هذا التكوين واختباره، ثم إعادة تشغيل Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/meter /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### الخطوة 7: تفعيل شهادة الأمان المجانية (HTTPS / SSL)

إذا كان لديك اسم نطاق (Domain Name) موجه إلى IP الخادم، قم بتشغيل الأوامر التالية لتفعيل SSL مجاناً عبر Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 🔄 كيفية تحديث التطبيق لاحقًا عند رفع تعديلات جديدة على GitHub

عند إجراء أي تحديثات جديدة في الكود ورفعها إلى GitHub، يمكنك التحديث على الـ VPS بتشغيل هذا الأوامر المتتالية:

```bash
cd /var/www/meter
git remote set-url origin https://***REMOVED_TOKEN***@github.com/abdulazizh/Meter-Reader.git
git pull origin main
npm install
npm run server:build
npm run db:push
pm2 restart meter
```

---

## 🛠️ حل المشاكل الشائعة

### خطأ `HTTP 401 Unauthorized` أثناء `git pull`

يحدث هذا الخطأ لأن المستودع (Repository) خاص (Private) على GitHub والـ VPS لا يملك صلاحية الوصول التلقائية عبر HTTPS.

#### الحل الأول: استخدام Personal Access Token (الأسرع والأسهل)

1. أنشئ توكن وصول من GitHub:
   - اذهب إلى **GitHub** -> اضغط على صورة ملفك الشخصي -> **Settings**.
   - اختر **Developer Settings** (في أسفل القائمة الجانبية).
   - اختر **Personal access tokens** -> **Tokens (classic)** -> اضغط **Generate new token (classic)**.
   - سمّ التوكن (مثلاً: `VPS Token`) وحدد خيار **`repo`** (Full control of private repositories).
   - انقر **Generate token** واقسخ التوكن الناتج (`ghp_xxxxxxxxxxxx`).

2. قم بتحديث رابط المستودع في الـ VPS عبر الأمر التالي (استبدل `TOKEN` بالتوكن و `USERNAME` باسم حسابك و `REPO` باسم المستودع):

```bash
git remote set-url origin https://TOKEN@github.com/USERNAME/REPO.git
```

مثال:
```bash
git remote set-url origin https://ghp_123456789xyz@github.com/myuser/meter-reader.git
```

3. جرب سحب التحديثات مجدداً:
```bash
git pull origin main
```

---

#### الحل الثاني: استخدام مفاتيح SSH (الأكثر أماناً وموصى به)

1. إنشاء مفتاح SSH على الخادم الـ VPS:
```bash
ssh-keygen -t ed25519 -C "vps-meter-reader"
```
*(اضغط Enter لجميع الأسئلة).*

2. عرض المفتاح العام ونسخه:
```bash
cat ~/.ssh/id_ed25519.pub
```

3. إضافته إلى GitHub:
   - اذهب إلى **GitHub Settings** -> **SSH and GPG keys** -> **New SSH key**.
   - الصق المفتاح واضغط **Add SSH key**.

4. تغيير رابط origin إلى SSH في الـ VPS:
```bash
git remote set-url origin git@github.com:USERNAME/REPO.git
git pull origin main
```

