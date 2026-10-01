# مخطط السفر الذكي

تطبيق PWA عربي لحساب رحلة متعددة المدن مع تقديرات للطيران والفنادق والوجبات والأنشطة، وجلب الطقس من Open-Meteo.

## ما يعمل الآن
- اختيار الدولة ومدينة المغادرة والفترة وعدد المسافرين والغرف ونجوم الفندق.
- اختيار أكثر من مدينة وتوزيع الأيام بينها.
- حساب تقريبي منفصل للطيران والفنادق والوجبات والأنشطة والتنقل.
- جلب توقع الطقس الحي عندما تكون الرحلة ضمن نافذة التوقع، واستخدام متوسط تاريخي للرحلات الأبعد.
- حفظ الرحلات محليًا.
- طباعة الخطة / حفظها PDF من المتصفح.
- PWA قابل للتثبيت ويعمل دون اتصال للواجهة الأساسية.

## مهم بخصوص الأسعار الحية
GitHub Pages موقع Static؛ لا يجب وضع Client Secret لمزود طيران أو فنادق داخل JavaScript في المتصفح. للربط الحقيقي يوصى بإضافة Backend آمن (Cloudflare Worker / Firebase Function / Vercel Function) ثم ربط أحد المزودين مثل Amadeus أو مزود حجوزات معتمد.

## GitHub Pages
بعد رفع الملفات إلى الفرع `main`:
1. Settings → Pages
2. Source: Deploy from a branch
3. Branch: `main` / root

## خارطة التطوير
1. Live flight adapter.
2. Live hotel adapter.
3. Events adapter.
4. Currency conversion.
5. Visa/insurance/shopping budgets.
6. Route optimization between cities.
7. AI itinerary generation within a fixed budget.
