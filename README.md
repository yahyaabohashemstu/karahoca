# KARAHOCA React + Vite Website

الموقع الرسمي لشركة KARAHOCA KIMYA، مبني بتقنيات React وTypeScript وVite مع دعم كامل للغة العربية واتجاه RTL. يتضمن المشروع صفحات العلامات التجارية (DIOX وAYLUX)، أقسام تعرّف بالشركة، وواجهة زجاجية أنيقة بالإضافة إلى مساعد ذكاء اصطناعي يعتمد على Gemini.

## المتطلبات

- Node.js 18 أو أحدث
- npm 9 أو أحدث
- مفتاح واجهة Gemini (Google AI Studio) محفوظ على الخادم

## أوامر التشغيل

`ash
npm install          # تثبيت الحزم مرة واحدة
npm run dev          # تشغيل واجهة Vite + API المحلي معاً
npm run dev:web      # تشغيل واجهة Vite فقط على المنفذ 5173
npm run dev:api      # تشغيل API المحلي على المنفذ 5000
npm run build        # إنشاء نسخة الإنتاج داخل dist/
npm run preview      # معاينة نسخة الإنتاج + API المحلي معاً
npm run preview:web  # معاينة نسخة الإنتاج فقط
npm run start        # تشغيل API المحلي بعد البناء
`

## إعداد المساعد والـ API

1. أنشئ ملفًا باسم .env في جذر المشروع karahoca-react-vite/.
2. أضف إعدادات الخادم التالية:

`nv
GEMINI_API_KEY=ضع_المفتاح_هنا
SITE_URL=https://your-frontend-domain.com
FRONTEND_URL=https://your-frontend-domain.com
`

3. إذا كنت تشغّل الواجهة محليًا على 5173 والـ API على 5000، أضف أيضًا:

`nv
VITE_BACKEND_URL=http://localhost:5000
`

4. في النشر الفعلي:
- اترك VITE_BACKEND_URL فارغًا إذا كانت الواجهة والـ API على نفس النطاق.
- أو اضبطه على رابط الـ API العام الفعلي مثل https://api.example.com إذا كانا على نطاقين مختلفين.
- لا تستخدم http://localhost:5000 في نسخة منشورة للعامة.

> **مهم:** لم يعد مفتاح Gemini يُقرأ من الواجهة الأمامية. الواجهة تستدعي API محليًا أو عامًا، والخادم فقط هو الذي يستهلك GEMINI_API_KEY.

## لوحة التحكم (المرحلة الأولى)

تمت إضافة نواة لوحة تحكم أولية تشمل:
- تسجيل دخول مدير واحد.
- إدارة منتجات أساسية مع ترجمة تلقائية (Gemini) إلى `ar/en/tr/ru`.
- تتبع مستخدمي محادثات البوت في قاعدة البيانات.

المتغيرات المطلوبة في `.env`:

`env
DATABASE_URL=postgres://user:password@localhost:5432/karahoca
ADMIN_JWT_SECRET=change_me_to_a_long_random_secret
ADMIN_EMAIL=admin@karahoca.local
ADMIN_PASSWORD=change_me_now
`

مسارات الواجهة:
- `/admin/login`
- `/admin/products`
- `/admin/news`
- `/admin/chats`

واجهات API الإدارية:
- `POST /admin/auth/login`
- `GET /admin/products`
- `POST /admin/products`
- `PATCH /admin/products/:id`
- `DELETE /admin/products/:id` (soft delete)
- `GET /admin/news`
- `POST /admin/news`
- `PATCH /admin/news/:id`
- `DELETE /admin/news/:id` (soft delete)
- `GET /admin/chats/users`
- `GET /admin/chats/users/:id/conversations`
- `GET /admin/chats/conversations/:id/messages`

## تخصيص قاعدة المعرفة

- قم بتعديل ملف src/data/aiKnowledge.ts لتحديث المعلومات التي يعتمد عليها المساعد.
- يمكنك إضافة أقسام جديدة أو تعديل التوجيهات اللغوية من نفس الملف لضمان إجابات دقيقة ومتناسقة مع هوية KARAHOCA.

## بنية المشروع المختصرة

- src/components/ مكونات الواجهة (الهيدر، الأقسام، مساعد الذكاء الاصطناعي، ...)
- src/pages/ الصفحات الفرعية الخاصة بالعلامات التجارية والمحتوى التعريفي
- src/styles/ ملفات الأنماط العامة والمتخصصة
- src/data/ مصادر البيانات الثابتة مثل قاعدة المعرفة الخاصة بالمساعد
- server/ واجهة API محلية للمحادثة وطلبات النشرة البريدية

## نشر الموقع

- قم بتشغيل 
pm run build لإنشاء مجلد dist/.
- استضف المجلد الناتج على أي خدمة استضافة ثابتة (Netlify، Vercel، Cloudflare Pages...).
- شغّل server/server.mjs أو 
pm run start في خدمة Node منفصلة إذا كنت تستخدم نطاق API مستقلًا.
- إذا كان الـ frontend والـ API على نطاقين مختلفين، اضبط FRONTEND_URL أو SITE_URL على نطاق الواجهة المنشور، ويمكن استخدام ALLOWED_ORIGINS للنطاقات الإضافية.

## الدعم والتواصل

- البريد الرسمي: info@karahoca.com
- واتساب خدمة العملاء: +90 530 591 4990

