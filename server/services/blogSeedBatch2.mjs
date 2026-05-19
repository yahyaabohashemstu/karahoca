/**
 * Second batch of evergreen blog posts seeded under their own
 * migration sentinel (`blog_seed_v2`) so they ship even on databases
 * where the original `initial_blog` migration has already been
 * marked done with only the first 3 posts.
 *
 * Authored as practical, research-grounded content (not marketing
 * fluff) so the blog has real SEO value from day one. Each post
 * lives in all 4 languages with full markdown — H2/H3 headings,
 * tables, callouts, and product cross-links.
 *
 * Topics chosen for evergreen search demand + commercial overlap:
 *   1. Bathroom deep-clean (grout, lime, mould — the searches that
 *      drive people from "how do I clean" to product purchase)
 *   2. Laundry mistakes (corrects misconceptions; positions DIOX as
 *      "the one that doesn't damage clothes")
 *   3. Pet- and child-safe cleaning (huge anxiety topic in 2024+)
 *   4. Stain removal cheatsheet (table-format = great for featured-
 *      snippet capture in Google)
 */

export const BLOG_BATCH_2 = [
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 'post-bathroom-deep-clean',
    slug: 'bathroom-deep-clean-complete-guide',
    category_id: 'cat-cleaning-tips',
    image: '/aylux-images/آيلوكس مزيل البقع.webp',
    hero_image: '/aylux-images/آيلوكس مزيل البقع.webp',
    featured: 1,
    tags: ['bathroom', 'tile', 'mould', 'lime'],
    title: {
      ar: 'تنظيف الحمّام بعمق: دليل شامل من الترسّبات إلى الرائحة',
      en: 'Bathroom Deep Clean: A Complete Guide from Limescale to Smell',
      tr: 'Banyo Derin Temizliği: Kireçten Kokuya Kapsamlı Rehber',
      ru: 'Глубокая уборка ванной: полное руководство от налёта до запаха',
    },
    excerpt: {
      ar: '4 مشاكل تواجه كلّ حمّام تقريباً — ترسّبات الكلس، العفن الأسود بين البلاط، الروائح من البالوعة، وبقع الصدأ — وكيف نحلّها كيميائياً وليس فقط بفركٍ يدوي.',
      en: 'Four problems every bathroom faces — limescale, black mould between tiles, drain smells, and rust spots — and how to fix them chemically, not just by scrubbing.',
      tr: 'Her banyoda görülen 4 sorun — kireç, fayans arasındaki siyah küf, gider kokusu ve pas lekeleri — ve bunları sadece ovarak değil kimyasal olarak nasıl çözeriz.',
      ru: 'Четыре проблемы любой ванной — налёт, чёрная плесень между плиткой, запах из канализации и пятна ржавчины — и как решить их химически, а не только тряпкой.',
    },
    body: {
      ar: `الحمّام أصعب غرفة في المنزل من ناحية التنظيف لأنّ كل سنتمتر فيها يتعرّض لمزيج من **الرطوبة، الصابون، الجلد الميّت، والمياه القاسية**. الفرك العادي لا يحلّ المشكلة — لازم نتعامل كيميائياً مع كل نوع تلوّث.

## 1. ترسّبات الكلس (Limescale) — الطبقة البيضاء/الصفراء

ترسّبات الكلس هي **كربونات الكالسيوم** من مياه الصنبور. تتراكم على:
- صنابير المياه
- زجاج الكابينة
- داخل المرحاض
- رأس الدوش

**الحلّ:** أيّ منظّف **حامضي** (pH < 4) يذيب الكلس. خيارات:
- **خلّ أبيض** مع ماء بنسبة 1:1 — رخيص لكن يحتاج وقت طويل (20-30 دقيقة)
- **منتجات حامضية مخصّصة** مثل **AYLUX منظف الحمّام** — يعمل في 3-5 دقائق

**خطوات الاستخدام:**
1. رشّ المنتج على المنطقة المصابة وهي **جافّة** تماماً
2. اتركه 5-10 دقائق (تسمع فقاعات صغيرة = التفاعل يحصل)
3. افرك بفرشاة نايلون (ليست معدنية)
4. اشطف بماء وفير

> **تحذير مهم:** لا تستخدم منظّفات حامضية على الرخام أو الجرانيت — تذيب اللمعان وتترك بقعاً دائمة. للرخام استخدم منظّفات pH متعادل.

## 2. العفن الأسود بين البلاط (Grout Mould)

النقاط السوداء بين بلاط الحمّام ليست أوساخاً — هي **عفن حيّ** يتغذّى على الرطوبة وبقايا الصابون. الفرك يزيل الطبقة العلوية فقط، والعفن يعود خلال أيام.

**الحلّ:** **محلول مبيّض كلوري بتركيز 5-7٪** يقتل العفن من جذوره:
- استخدم **DIOX كلور** أو **AYLUX كلور** مخفّفاً بنسبة 1:3 (كوب كلور + 3 أكواب ماء)
- رشّه على الـ grout فقط (تجنّب التماس مع الألمنيوم والمعدن)
- اتركه **20 دقيقة كاملة** — هذا الوقت ضروري لقتل الأبواغ
- افرك بفرشاة أسنان قديمة
- اشطف جيداً

> **تحذير:** لا تخلط الكلور مع الخلّ أو منظّف الحمّام الحامضي — يُنتج غاز الكلور السامّ. استخدم منتجاً واحداً في كلّ مرّة.

**للوقاية مستقبلاً:** بعد كلّ استحمام، **جفّف البلاط** بممسحة مطّاطية (squeegee) — هذا يقطع دورة الرطوبة التي يحتاجها العفن للنمو.

## 3. روائح البالوعة

الرائحة الكريهة من بالوعة الحمّام لها سببان:
- **شعر متراكم** يحتفظ بالماء الراكد
- **بكتيريا تتغذّى** على بقايا الصابون والجلد الميّت في الأنبوب

**الحلّ:**

1. **أزل الشعر يدوياً** بأداة مرنة (يوجد في كل سوبر ماركت بـ 5 ليرات).
2. **اسكب كوب من البيكنغ صودا** يليه كوب من الخلّ — ستبدأ الفقاعات تذيب البقايا العضوية.
3. اتركه 15 دقيقة، ثمّ **اسكب 2 لتر ماء مغلي** لتنظيف الأنبوب.
4. للنظافة الأسبوعية، اسكب نصف كوب من **DIOX كلور** قبل النوم — يقتل البكتيريا التي تنتج الرائحة طوال الليل.

## 4. بقع الصدأ

الصدأ من ماء حديدي، أو من علب الحلاقة المعدنية الموضوعة في رفّ مبتلّ.

**الحلّ:**
- **عصير ليمون** + **ملح خشن** = مزيل صدأ طبيعي ممتاز للبقع الصغيرة
- لبقع كبيرة، استخدم **منتج تجاري مخصّص للصدأ** (يحتوي حمض الأوكساليك)
- لا تستخدم سكاكين معدنية للحكّ — تخدش السطح وتثبّت الصدأ

## ✅ روتين أسبوعي مقترح

| اليوم | المهمّة |
|------|---------|
| **السبت** | تنظيف عميق بـ AYLUX منظف حمّام |
| **الإثنين** | شطف الـ grout بمحلول كلور خفيف |
| **الأربعاء** | تنظيف المرحاض بالداخل + بالخارج |
| **الجمعة** | تجفيف وتعطير |

---

**هل تدير فندقاً أو منشأة كبيرة؟** نوفّر **AYLUX منظف حمّام** بعبوات 5 لتر للجملة. [راسلنا للحصول على سعر العقد الشهري](mailto:info@karahoca.com).`,
      en: `The bathroom is the hardest room in the house because every square centimetre is exposed to a mix of **moisture, soap, dead skin, and hard water**. Normal scrubbing doesn't fix it — you have to deal with each contamination type chemically.

## 1. Limescale — the white/yellow film

Limescale is **calcium carbonate** from tap water. It builds up on:
- Faucets
- Shower glass
- Inside the toilet bowl
- Showerhead

**The fix:** any **acidic** cleaner (pH < 4) dissolves limescale. Options:
- **White vinegar** with water 1:1 — cheap but slow (20-30 min)
- **Dedicated acidic cleaners** like **AYLUX Bathroom Cleaner** — works in 3-5 min

**How to use:**
1. Spray on the affected area while it's **completely dry**
2. Wait 5-10 min (you'll hear tiny bubbles = the reaction is happening)
3. Scrub with a nylon brush (not metal)
4. Rinse with plenty of water

> **Important warning:** Don't use acidic cleaners on marble or granite — they dissolve the polish and leave permanent stains. For marble, use pH-neutral cleaners.

## 2. Black mould in grout

Those black dots between tiles aren't dirt — they're **living mould** that feeds on moisture and soap residue. Scrubbing removes only the top layer; the mould comes back within days.

**The fix:** **5-7% chlorine bleach solution** kills mould at the root:
- Use **DIOX Chlorine** or **AYLUX Chlorine** diluted 1:3 (1 cup bleach + 3 cups water)
- Spray on the grout only (avoid contact with aluminium and metal)
- Leave for a **full 20 minutes** — this time is essential to kill the spores
- Scrub with an old toothbrush
- Rinse thoroughly

> **Warning:** Never mix bleach with vinegar or acidic bathroom cleaner — it produces toxic chlorine gas. Use one product at a time.

**For prevention:** After every shower, **squeegee-dry the tiles** — this breaks the moisture cycle the mould needs to grow.

## 3. Drain smells

Bad smells from the bathroom drain have two causes:
- **Built-up hair** holding stagnant water
- **Bacteria feeding** on soap and skin residue inside the pipe

**The fix:**

1. **Remove hair manually** with a flexible drain snake (available at any hardware store).
2. **Pour one cup of baking soda** followed by one cup of vinegar — the bubbling dissolves organic residue.
3. Wait 15 minutes, then **pour 2 litres of boiling water** to flush the pipe.
4. For weekly maintenance, pour half a cup of **DIOX Chlorine** before bed — kills the bacteria producing the smell overnight.

## 4. Rust stains

Rust comes from iron-rich water, or from metal razor cans left on a wet shelf.

**The fix:**
- **Lemon juice** + **coarse salt** = a great natural rust remover for small spots
- For large stains, use a **dedicated commercial rust remover** (contains oxalic acid)
- Don't scrape with metal blades — it scratches the surface and locks the rust in

## ✅ Suggested weekly routine

| Day | Task |
|-----|------|
| **Saturday** | Deep clean with AYLUX Bathroom Cleaner |
| **Monday** | Rinse grout with light chlorine solution |
| **Wednesday** | Clean toilet inside + outside |
| **Friday** | Dry and deodorise |

---

**Running a hotel or large facility?** We supply **AYLUX Bathroom Cleaner** in 5 L bulk packs. [Contact us for monthly contract pricing](mailto:info@karahoca.com).`,
      tr: `Banyo evdeki en zor odadır çünkü her santimetrekare **nem, sabun, ölü deri ve sert su** karışımına maruz kalır. Normal ovma çözmez — her kirlilik tipiyle kimyasal olarak başa çıkmak gerekir.

## 1. Kireç — beyaz/sarı tabaka

Kireç, musluk suyundaki **kalsiyum karbonattır**. Şu yerlerde birikir:
- Musluklar
- Duşakabin camı
- Klozet içi
- Duş başlığı

**Çözüm:** herhangi bir **asitli** temizleyici (pH < 4) kireci çözer. Seçenekler:
- **Beyaz sirke** + su 1:1 — ucuz ama yavaş (20-30 dk)
- **Asitli özel temizleyiciler** **AYLUX Banyo Temizleyici** — 3-5 dakikada işe yarar

**Kullanım:**
1. **Tamamen kuru** yüzeye püskürtün
2. 5-10 dakika bekleyin (küçük baloncuklar = reaksiyon başladı)
3. Naylon fırça ile ovun (metal değil)
4. Bol suyla durulayın

> **Önemli uyarı:** Mermer veya granite asitli temizleyici kullanmayın — cilayı çözer, kalıcı leke bırakır. Mermer için pH nötr temizleyici kullanın.

## 2. Derz aralarında siyah küf

Fayanslar arasındaki o siyah noktalar kir değil — nem ve sabun kalıntısıyla beslenen **canlı küf**. Ovmak sadece üst tabakayı alır; küf günler içinde geri döner.

**Çözüm:** **%5-7 klorlu çamaşır suyu çözeltisi** küfü kökünden öldürür:
- **DIOX Klor** veya **AYLUX Klor**'u 1:3 oranında seyreltin (1 bardak klor + 3 bardak su)
- Sadece derz üzerine püskürtün (alüminyum ve metale temasından kaçının)
- **Tam 20 dakika** bekleyin — sporları öldürmek için bu süre şart
- Eski diş fırçasıyla ovun
- İyice durulayın

> **Uyarı:** Klorla sirkeyi veya asitli banyo temizleyicisini asla karıştırmayın — zehirli klor gazı çıkar. Her seferinde tek ürün kullanın.

**Önleme:** Her duştan sonra **fayansları temizleme bezi ile kurulayın** — küfün ihtiyacı olan nem döngüsünü kırarsınız.

## 3. Gider kokuları

Banyo giderinden gelen kokunun iki sebebi vardır:
- **Birikmiş saç** durgun suyu tutuyor
- **Bakteriler** boru içindeki sabun ve deri kalıntısıyla besleniyor

**Çözüm:**

1. **Elle saçı çıkarın** esnek bir gider aletiyle (her nalbur da var).
2. **Bir bardak karbonat** sonra bir bardak sirke dökün — köpük organik kalıntıları çözer.
3. 15 dakika bekleyin, sonra **2 litre kaynar su** dökerek boruyu temizleyin.
4. Haftalık bakım için yatmadan önce yarım bardak **DIOX Klor** dökün — gece boyunca koku üreten bakterileri öldürür.

## 4. Pas lekeleri

Pas, demirli sudan veya ıslak rafta bırakılmış metal jiletçi kutularından gelir.

**Çözüm:**
- **Limon suyu** + **iri tuz** = küçük lekeler için doğal pas çıkarıcı
- Büyük lekeler için **ticari pas çıkarıcı** (oksalik asit içerir)
- Metal bıçakla kazımayın — yüzeyi çizer, pası kalıcı hale getirir

## ✅ Önerilen haftalık rutin

| Gün | Görev |
|------|---------|
| **Cumartesi** | AYLUX Banyo Temizleyici ile derin temizlik |
| **Pazartesi** | Hafif klor çözeltisi ile derz durulama |
| **Çarşamba** | Klozet içi + dışı temizleme |
| **Cuma** | Kurutma ve koku verme |

---

**Otel veya büyük tesis mi işletiyorsunuz?** **AYLUX Banyo Temizleyici**'yi 5 L'lik toplu paketlerde tedarik ediyoruz. [Aylık sözleşme fiyatı için bize ulaşın](mailto:info@karahoca.com).`,
      ru: `Ванная — самая сложная комната в доме, потому что каждый сантиметр подвергается смеси **влаги, мыла, омертвевшей кожи и жёсткой воды**. Обычная чистка не решает проблему — нужно химически справиться с каждым типом загрязнения.

## 1. Известковый налёт — белая/жёлтая плёнка

Налёт — это **карбонат кальция** из водопроводной воды. Скапливается на:
- Кранах
- Стекле душевой кабины
- Внутри унитаза
- Лейке душа

**Решение:** любое **кислотное** средство (pH < 4) растворяет налёт. Варианты:
- **Белый уксус** + вода 1:1 — дёшево, но медленно (20-30 мин)
- **Специальные кислотные средства** как **AYLUX средство для ванной** — работает за 3-5 мин

**Как использовать:**
1. Распылите на **полностью сухую** поверхность
2. Подождите 5-10 минут (мелкие пузырьки = реакция пошла)
3. Потрите нейлоновой щёткой (не металлической)
4. Тщательно смойте водой

> **Важное предупреждение:** Не используйте кислотные средства на мраморе или граните — они растворяют полировку и оставляют несмываемые пятна. Для мрамора используйте pH-нейтральные средства.

## 2. Чёрная плесень в швах

Чёрные точки между плиткой — не грязь, а **живая плесень**, которая питается влагой и мыльным налётом. Чистка снимает только верхний слой; плесень возвращается за несколько дней.

**Решение:** **5-7% раствор хлорного отбеливателя** убивает плесень в корне:
- Разведите **DIOX Хлор** или **AYLUX Хлор** 1:3 (1 стакан хлора + 3 стакана воды)
- Распылите только на швы (избегайте контакта с алюминием и металлом)
- Оставьте на **полные 20 минут** — этого времени требует уничтожение спор
- Потрите старой зубной щёткой
- Тщательно смойте

> **Предупреждение:** Никогда не смешивайте хлор с уксусом или кислотным средством — образуется ядовитый газ. Используйте одно средство за раз.

**Профилактика:** После каждого душа **протирайте плитку резиновым скребком** — это разрывает цикл влаги, нужный плесени для роста.

## 3. Запах из слива

У запаха из слива две причины:
- **Скопившиеся волосы** удерживают стоячую воду
- **Бактерии**, питающиеся мыльным и кожным налётом внутри трубы

**Решение:**

1. **Удалите волосы вручную** с помощью гибкого крючка (продаётся в любом хозмаге).
2. **Налейте стакан соды**, затем стакан уксуса — шипение растворит органику.
3. Подождите 15 минут, затем **залейте 2 литра кипятка**, чтобы промыть трубу.
4. Для еженедельного ухода налейте полстакана **DIOX Хлора** на ночь — убьёт ночные бактерии запаха.

## 4. Пятна ржавчины

Ржавчина появляется от железистой воды или металлических банок, забытых на мокрой полке.

**Решение:**
- **Лимонный сок** + **крупная соль** = отличное натуральное средство для маленьких пятен
- Для больших пятен **специальное промышленное средство** (содержит щавелевую кислоту)
- Не скоблите металлическим лезвием — поцарапает поверхность, ржавчина впитается глубже

## ✅ Рекомендуемый недельный ритуал

| День | Задача |
|------|---------|
| **Суббота** | Глубокая уборка с AYLUX средством для ванной |
| **Понедельник** | Промывка швов слабым раствором хлора |
| **Среда** | Уборка унитаза внутри + снаружи |
| **Пятница** | Сушка и ароматизация |

---

**Управляете отелем или большим объектом?** Мы поставляем **AYLUX средство для ванной** в канистрах 5 л оптом. [Свяжитесь с нами для ценового предложения](mailto:info@karahoca.com).`,
    },
    author_name: 'فريق KARAHOCA',
    reading_time: 7,
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    id: 'post-laundry-mistakes',
    slug: 'common-laundry-mistakes-ruining-clothes',
    category_id: 'cat-cleaning-tips',
    image: '/diox-images/ديوكس سائل غسيل (1).webp',
    hero_image: '/diox-images/ديوكس سائل غسيل (1).webp',
    featured: 0,
    tags: ['laundry', 'mistakes', 'fabric-care'],
    title: {
      ar: '7 أخطاء شائعة في الغسيل تختصر عمر ملابسك للنصف',
      en: '7 Common Laundry Mistakes That Cut Your Clothes\' Life in Half',
      tr: 'Kıyafetlerinizin Ömrünü Yarıya İndiren 7 Yaygın Yıkama Hatası',
      ru: '7 ошибок при стирке, сокращающих жизнь одежды вдвое',
    },
    excerpt: {
      ar: 'دراسات الصناعة تقول إنّ 70٪ من تلف الأقمشة سببه طريقة الغسيل، وليس عمر الثوب. هذه 7 أخطاء يفعلها الجميع تقريباً، وكيف نتجنّبها.',
      en: 'Industry studies show 70% of fabric damage comes from how clothes are washed, not how old they are. These are 7 mistakes nearly everyone makes — and how to avoid them.',
      tr: 'Endüstri araştırmaları, kumaş hasarının %70\'inin yaştan değil yıkama şeklinden kaynaklandığını gösteriyor. Hemen herkesin yaptığı 7 hata ve nasıl önlenir.',
      ru: 'Отраслевые исследования показывают, что 70% повреждений ткани — следствие способа стирки, а не возраста одежды. Семь ошибок, которые делают почти все.',
    },
    body: {
      ar: `كم مرّة قلت "هذا القميص لم يدم طويلاً"؟ في الواقع، أكثر تلف الأقمشة لا يحصل من اللبس — يحصل من الغسّالة. هذه 7 أخطاء يفعلها معظم الناس.

## ❌ الخطأ 1: استخدام كمّية مسحوق مضاعفة

اعتقاد شائع: "ملابسي وسخة جداً، إذن أحتاج مسحوقاً أكثر."

الحقيقة: المسحوق الزائد **لا يذوب كامل** ويترك بقايا بيضاء على القماش. هذه البقايا تحبس الأوساخ في ألياف القماش وتضعفه.

**الصحيح:** اتّبع الكمّية الموصى بها على عبوة **DIOX مسحوق غسيل أوتوماتيك** بدقّة:
- غسلة عادية: 70 غرام
- غسلة قذرة جداً: 100 غرام (الحدّ الأقصى)

## ❌ الخطأ 2: درجة حرارة خاطئة

الكثير يغسل كلّ شيء على 60 درجة "للتعقيم". المشكلة: درجات الحرارة العالية:
- تثبّت بقع الدم والبيض والعرق (تتجلطن وتصبح دائمة)
- تتلف ألياف الصوف والحرير
- تخفّف ألوان القطن الملوّن

**الصحيح:**

| نوع البقعة | الحرارة المثالية |
|-----------|-----------------|
| دم، عرق، بيض | **ماء بارد** (20-30°) |
| طعام، شحوم | 40° |
| ملاءات وفوط بيضاء | 60° |
| ملابس داخلية (تعقيم) | 90° |

## ❌ الخطأ 3: تجميع الغسيل لأسبوع كامل

البقع الطازجة (أقلّ من 24 ساعة) تخرج بسهولة. بعد أسبوع، البقعة تتأكسد وتلتصق كيميائياً بألياف القماش.

**الصحيح:** اغسل البقع الجديدة في يومها. لو لا تستطيع، رشّ المنطقة بـ **DIOX مزيل بقع** فوراً ودعها مبتلّة حتّى يوم الغسيل.

## ❌ الخطأ 4: تعبئة الغسّالة لآخرها

اعتقاد: "كلّما زادت الملابس وفّرت طاقة وماء."

الحقيقة: الملابس المضغوطة **لا تتحرّك** داخل الحلّة، فلا يصل إليها الماء والمنظّف بشكل صحيح. النتيجة: غسلة سطحية + مسحوق عالق على الأقمشة.

**الصحيح:** املأ الحلّة بـ **70٪** من سعتها. عند إغلاق الباب، يجب أن تستطيع وضع كفّ يدك أفقياً فوق الملابس.

## ❌ الخطأ 5: عدم فصل الألوان

"الألوان الداكنة لا تتأثّر" — خطأ. ألوان مثل الكحلي والأسود تطلق صبغة في الماء الساخن، وهذه الصبغة تستقرّ على ملابس فاتحة في نفس الغسلة.

**الصحيح:** اقسم على 3 سلال:
- **بيض/فاتح** — قمصان بيضاء، ملابس داخلية
- **ملوّن** — أحمر، أصفر، أخضر
- **داكن** — كحلي، أسود، رمادي

## ❌ الخطأ 6: ترك الملابس مبتلّة بعد الغسلة

ملابس مبتلّة لأكثر من **ساعة** في الحلّة تطوّر:
- رائحة عفن
- بكتيريا
- لون مصفرّ

**الصحيح:** انقل الغسيل للنشر فور انتهاء الدورة. لو نسيت، أعد الغسلة بـ نصف كمّية مسحوق.

## ❌ الخطأ 7: تجاهل **مطري الأقمشة**

الكثيرون يعتبرون مطري الأقمشة "كمالي". في الحقيقة، له 3 فوائد عملية:
1. **يقلّل التجاعيد** = أقلّ كيّ
2. **يمنع الكهرباء الساكنة** في الشتاء
3. **يحمي الألياف** من الاحتكاك في الغسلة

**منتجنا الموصى به:** **DIOX مطري الغسيل** — يأتي بـ 6 نكهات معطّرة + يحوي عناصر تطيل عمر القماش.

## 💡 ملخّص سريع للذاكرة

> **القاعدة الذهبية:** ماء بارد + كمّية موصى بها من المسحوق + 70٪ ملء + فصل الألوان + نشر سريع.

اتباع هذا الـ workflow يمدّ عمر ملابسك **2-3 سنوات إضافية**.

---

**هل أنت صاحب مغسلة أو فندق؟** نقدّم تركيبات صناعية من **DIOX** بتركيز أعلى للغسّالات التجارية. [اطلب عيّنة مجّانية](mailto:info@karahoca.com).`,
      en: `How often have you said "this shirt didn't last long"? In reality, most fabric damage doesn't come from wear — it comes from the washing machine. Here are 7 mistakes most people make.

## ❌ Mistake 1: Doubling the detergent

Common belief: "My clothes are really dirty, so I need more detergent."

Reality: Excess detergent **doesn't fully dissolve** and leaves white residue on the fabric. That residue traps dirt in the fibres and weakens them.

**Right way:** Follow the dose on the **DIOX Automatic Laundry Powder** pack:
- Normal wash: 70 g
- Heavily soiled: 100 g (max)

## ❌ Mistake 2: Wrong temperature

Many people wash everything at 60°C "to sterilise". The problem: high heat:
- Sets blood, egg, and sweat stains (they coagulate permanently)
- Damages wool and silk fibres
- Fades coloured cotton

**Right way:**

| Stain type | Best temperature |
|-----------|-----------------|
| Blood, sweat, egg | **Cold water** (20-30°) |
| Food, grease | 40° |
| White sheets and towels | 60° |
| Underwear (sterilise) | 90° |

## ❌ Mistake 3: Letting laundry pile up for a week

Fresh stains (under 24 hours) come out easily. After a week, the stain oxidises and chemically bonds with the fabric fibres.

**Right way:** Wash new stains the same day. If you can't, spray the spot with **DIOX Stain Remover** immediately and leave it wet until wash day.

## ❌ Mistake 4: Overfilling the washer

Belief: "More clothes = saving energy and water."

Reality: Compressed clothes **can't tumble** inside the drum, so water and detergent don't reach them properly. Result: a superficial wash + detergent stuck on fabric.

**Right way:** Fill the drum to **70%** of its capacity. When you close the door, you should fit your hand horizontally on top of the clothes.

## ❌ Mistake 5: Not separating colours

"Dark colours aren't affected" — wrong. Colours like navy and black release dye in hot water, and that dye settles on light items in the same wash.

**Right way:** Split into 3 bins:
- **White/light** — white shirts, underwear
- **Coloured** — red, yellow, green
- **Dark** — navy, black, grey

## ❌ Mistake 6: Leaving clothes wet after the cycle

Clothes wet for more than **1 hour** in the drum develop:
- Musty smell
- Bacteria
- Yellow discolouration

**Right way:** Move laundry to the dryer or line immediately after the cycle. If you forget, redo the wash with half the detergent.

## ❌ Mistake 7: Skipping **fabric softener**

Many treat softener as optional. In reality it has 3 practical benefits:
1. **Fewer wrinkles** = less ironing
2. **No static electricity** in winter
3. **Protects fibres** from friction in the wash

**Our recommendation:** **DIOX Fabric Softener** — comes in 6 scents + contains agents that extend fabric life.

## 💡 Quick summary for memory

> **Golden rule:** Cold water + recommended dose + 70% fill + colour separation + fast unloading.

Following this workflow extends your clothes' life by **2-3 extra years**.

---

**Run a laundromat or hotel?** We offer industrial **DIOX** formulations with higher concentration for commercial washers. [Request a free sample](mailto:info@karahoca.com).`,
      tr: `Kaç kez "bu gömlek çok uzun dayanmadı" dediniz? Aslında kumaş hasarının çoğu giyimden değil çamaşır makinesinden gelir. İşte herkesin yaptığı 7 hata.

## ❌ Hata 1: Deterjan miktarını iki katına çıkarmak

Yaygın inanç: "Çamaşırlarım çok kirli, daha fazla deterjan lazım."

Gerçek: Fazla deterjan **tam erimez** ve kumaşta beyaz kalıntı bırakır. Bu kalıntı kiri liflere hapseder ve kumaşı zayıflatır.

**Doğrusu:** **DIOX Otomatik Çamaşır Tozu** ambalajındaki dozu izleyin:
- Normal yıkama: 70 g
- Çok kirli: 100 g (maksimum)

## ❌ Hata 2: Yanlış sıcaklık

Birçoğu her şeyi 60°C de "sterilizasyon için" yıkar. Sorun: yüksek ısı:
- Kan, yumurta, ter lekelerini sabitler (kalıcı olur)
- Yün ve ipek liflerini bozar
- Renkli pamuğun rengini açar

**Doğrusu:**

| Leke tipi | Uygun sıcaklık |
|-----------|-----------------|
| Kan, ter, yumurta | **Soğuk su** (20-30°) |
| Yemek, yağ | 40° |
| Beyaz çarşaf ve havlu | 60° |
| İç çamaşırı (sterilizasyon) | 90° |

## ❌ Hata 3: Çamaşırı bir hafta biriktirmek

Taze lekeler (24 saatten az) kolay çıkar. Bir hafta sonra leke oksitlenir ve liflere kimyasal olarak bağlanır.

**Doğrusu:** Yeni lekeleri aynı gün yıkayın. Yapamıyorsanız, lekeyi hemen **DIOX Leke Çıkarıcı** ile ıslatın ve yıkama gününe kadar nemli tutun.

## ❌ Hata 4: Makineyi tıka basa doldurmak

İnanç: "Daha fazla çamaşır = enerji ve su tasarrufu."

Gerçek: Sıkıştırılmış çamaşır **dönemez**, su ve deterjan tam ulaşmaz. Sonuç: yüzeysel yıkama + kumaşa yapışan deterjan.

**Doğrusu:** Tamburu kapasitenin **%70**'ine kadar doldurun. Kapağı kaparken çamaşırların üstüne yatay olarak elinizi koyabilmeli.

## ❌ Hata 5: Renkleri ayırmamak

"Koyu renkler etkilenmez" — yanlış. Lacivert ve siyah, sıcak suda boyalarını bırakır ve bu boya aynı yıkamadaki açık renklere geçer.

**Doğrusu:** 3 sepete ayırın:
- **Beyaz/açık** — beyaz gömlekler, iç çamaşırı
- **Renkli** — kırmızı, sarı, yeşil
- **Koyu** — lacivert, siyah, gri

## ❌ Hata 6: Yıkamadan sonra ıslak bırakmak

Tamburda **1 saatten fazla** ıslak kalan çamaşır:
- Küf kokusu
- Bakteri
- Sararma

**Doğrusu:** Döngü biter bitmez asın. Unutursanız yarı dozla tekrar yıkayın.

## ❌ Hata 7: **Yumuşatıcıyı** atlamak

Birçoğu yumuşatıcıyı opsiyonel sayar. Aslında 3 pratik faydası var:
1. **Daha az kırışıklık** = daha az ütü
2. **Statik elektrik yok** kışın
3. **Lifleri korur** sürtünmeden

**Önerimiz:** **DIOX Yumuşatıcı** — 6 koku + kumaş ömrünü uzatan bileşenler.

## 💡 Hatırlatma için kısa özet

> **Altın kural:** Soğuk su + önerilen doz + %70 doluluk + renk ayrımı + hızlı boşaltma.

Bu akışı izlemek kıyafetlerinizin ömrünü **2-3 yıl** uzatır.

---

**Çamaşırhane veya otel mi işletiyorsunuz?** Ticari makineler için daha yoğun **DIOX** endüstriyel formülasyonları sunuyoruz. [Ücretsiz numune isteyin](mailto:info@karahoca.com).`,
      ru: `Сколько раз вы говорили: «эта рубашка быстро износилась»? На самом деле большая часть повреждений ткани — не от носки, а от стиральной машины. Вот 7 ошибок, которые делают почти все.

## ❌ Ошибка 1: Удваивать дозу порошка

Распространённое мнение: «Одежда очень грязная — значит, нужно больше порошка.»

Реальность: Лишний порошок **не растворяется полностью** и оставляет белый налёт на ткани. Этот налёт запирает грязь в волокнах и ослабляет их.

**Правильно:** Соблюдайте дозу на упаковке **DIOX Стирального порошка автомат**:
- Обычная стирка: 70 г
- Сильно загрязнённое: 100 г (максимум)

## ❌ Ошибка 2: Неправильная температура

Многие стирают всё при 60°C «для дезинфекции». Проблема: высокая температура:
- Закрепляет кровь, белок, пот (становятся несмываемыми)
- Разрушает шерсть и шёлк
- Выцветает цветной хлопок

**Правильно:**

| Тип пятна | Идеальная температура |
|-----------|-----------------------|
| Кровь, пот, белок | **Холодная вода** (20-30°) |
| Еда, жир | 40° |
| Белые простыни и полотенца | 60° |
| Нижнее бельё (дезинфекция) | 90° |

## ❌ Ошибка 3: Накапливать бельё на неделю

Свежие пятна (менее 24 часов) выходят легко. Через неделю пятно окисляется и химически связывается с волокном.

**Правильно:** Стирайте свежие пятна в тот же день. Если не можете — обрызгайте **DIOX пятновыводителем** и держите влажным до дня стирки.

## ❌ Ошибка 4: Переполнять барабан

Мнение: «Больше белья = экономия энергии и воды.»

Реальность: Сжатое бельё **не вращается** в барабане, вода и порошок плохо проникают. Итог: поверхностная стирка + порошок на ткани.

**Правильно:** Заполняйте барабан на **70%**. При закрытой дверце ладонь должна горизонтально помещаться поверх белья.

## ❌ Ошибка 5: Не разделять цвета

«Тёмные не страдают» — неверно. Синие и чёрные отдают краситель в горячей воде, и он садится на светлые вещи в той же стирке.

**Правильно:** Делите на 3 корзины:
- **Белое/светлое** — белые рубашки, нижнее бельё
- **Цветное** — красный, жёлтый, зелёный
- **Тёмное** — синий, чёрный, серый

## ❌ Ошибка 6: Оставлять бельё мокрым

Мокрое бельё больше **1 часа** в барабане получает:
- Запах сырости
- Бактерии
- Желтизну

**Правильно:** Сразу после цикла перенесите в сушилку или на верёвку. Если забыли — перестирайте с половиной дозы.

## ❌ Ошибка 7: Пропускать **кондиционер**

Многие считают кондиционер опциональным. На деле 3 практических плюса:
1. **Меньше складок** = меньше глажки
2. **Нет статики** зимой
3. **Защищает волокна** от трения в стирке

**Наша рекомендация:** **DIOX кондиционер для белья** — 6 ароматов + компоненты, продлевающие жизнь ткани.

## 💡 Краткая шпаргалка

> **Золотое правило:** Холодная вода + рекомендуемая доза + 70% заполнения + сортировка цветов + быстрое выгружание.

Этот процесс продлевает жизнь одежды на **2-3 года**.

---

**Управляете прачечной или отелем?** Предлагаем промышленные формулы **DIOX** с повышенной концентрацией. [Закажите бесплатный образец](mailto:info@karahoca.com).`,
    },
    author_name: 'فريق KARAHOCA',
    reading_time: 8,
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    id: 'post-pet-safe-cleaning',
    slug: 'pet-and-child-safe-cleaning-products',
    category_id: 'cat-how-to-choose',
    image: '/aylux-images/آيلوكس صابون سائل (1).webp',
    hero_image: '/aylux-images/آيلوكس صابون سائل (1).webp',
    featured: 1,
    tags: ['safety', 'pets', 'children', 'eco'],
    title: {
      ar: 'منتجات تنظيف آمنة للأطفال والحيوانات: ماذا تتجنّب وماذا تختار',
      en: 'Pet- and Child-Safe Cleaning Products: What to Avoid and What to Pick',
      tr: 'Çocuk ve Evcil Hayvan Dostu Temizlik Ürünleri: Nelerden Kaçınılır',
      ru: 'Безопасные средства для уборки с детьми и животными: что выбрать',
    },
    excerpt: {
      ar: 'الأطفال يلعقون الأرض، والقطط تلمس بأقدامها كلّ سطح ثمّ تلعقها. هذا الدليل يحدّد 7 مكوّنات خطرة ينبغي تجنّبها، وبدائل آمنة معتمدة من EU وFDA.',
      en: 'Toddlers lick the floor, cats walk on every surface then groom themselves. This guide identifies 7 dangerous ingredients to avoid and lists EU/FDA-approved safe alternatives.',
      tr: 'Bebekler yeri yalar, kediler her yüzeye basıp kendilerini yalar. Bu rehber 7 tehlikeli bileşeni ve EU/FDA onaylı güvenli alternatifleri listeler.',
      ru: 'Малыши облизывают пол, кошки ходят по всем поверхностям и потом вылизываются. Это руководство о 7 опасных ингредиентах и безопасных альтернативах ЕС/FDA.',
    },
    body: {
      ar: `إذا كان لديك طفل دون السنتين أو حيوان أليف، فإنّ كلّ منتج تنظيف تستخدمه ينتهي بطريقة ما في فمهم — إمّا عبر الأرضيّة، أو السجّاد، أو الأسطح التي يلامسونها بأيديهم/أقدامهم.

## ⚠️ 7 مكوّنات يجب تجنّبها

### 1. **Sodium Hypochlorite** (الكلور)
يسبّب حروقاً في الجلد والعينين. خطر للقطط بشكل خاصّ — أبخرته تضرّ رئاتها الصغيرة.

### 2. **Ammonia** (النشادر)
يهيّج الجهاز التنفّسي. مميت إذا اختلط مع الكلور (ينتج غاز الكلورامين).

### 3. **Glycol Ethers**
يوجد في منظّفات الزجاج الرخيصة. يؤثّر على الكلى عند الاستنشاق المستمرّ.

### 4. **Triclosan**
مضادّ بكتيريا قديم. تمّ حظره في EU وUS لأنّه يخلّ بنمو الغدد عند الأطفال.

### 5. **Phthalates** (الفثالات)
يوجد في "العطر" المضاف. مرتبط باضطرابات هرمونية.

### 6. **Formaldehyde**
يستخدم كمعقّم في منتجات قديمة. مسرطن مصنّف من WHO.

### 7. **2-Butoxyethanol**
في منظّفات الأرضيات الصناعية. يضرّ خلايا الدم الحمراء.

## ✅ مكوّنات آمنة عند الاستخدام الصحيح

| المكوّن | الاستخدام | الأمان |
|---------|----------|--------|
| **Sodium Lauryl Sulfate** | منظّف عامّ | آمن ما لم يبقى رطباً |
| **Citric Acid** | مزيل ترسّبات | آمن جداً (موجود في الفواكه) |
| **Hydrogen Peroxide 3%** | تعقيم | يتحلّل لماء وأكسجين |
| **Plant-based Surfactants** | غسيل | EU certified |

## 🐱 خصوصيات الحيوانات

**القطط أكثر حسّاسية من الكلاب** بسبب:
- لعق أقدامها باستمرار
- تنظيف الفرو بلسانها
- كبد القطط لا يفكّك بعض المكوّنات الفينولية

**تجنّب على وجه الخصوص للقطط:**
- ❌ Phenol وPine Sol
- ❌ Tea Tree Oil (سامّ للقطط حتّى بكمّيات صغيرة)
- ❌ منظّفات الأرضيات الحامضية القويّة

**للكلاب:**
- آمنة عموماً مع المنظّفات المنزلية المعتادة بعد التجفيف
- يجب إبعادها أثناء الاستخدام
- لا تستخدم Xylitol (موجود في بعض المعقّمات اليدوية) — مميت للكلاب

## 👶 خصوصيات الأطفال

الأطفال دون السنتين يلامسون كلّ شيء بأفواههم. القاعدة:
- **اشطف جيداً** بعد كلّ تنظيف (مرّتان بالماء النقي)
- **انتظر التجفيف الكامل** قبل إعادتهم للغرفة
- **تخزين خارج المتناول** — في خزانة مغلقة بعالٍ

## 🌿 منتجات KARAHOCA الآمنة

تشكيلاتنا تتّبع لوائح **EU REACH** و **AGRI-EU**:

### للأرضيّات (آمن للأطفال والحيوانات بعد التجفيف):
- **AYLUX منظف عام** — pH 7.5، خالٍ من Phthalates
- **DIOX منظف عام** — Plant-based surfactants

### للحمّامات:
- **AYLUX منظف الحمّام** — حامضي خفيف (سيتريك أسيد)
- ⚠️ لا تستخدم الكلور في حمّام يدخله طفل أو قطّة

### للغسيل:
- **DIOX سائل غسيل** — مناسب لملابس الأطفال
- ⚠️ تجنّب مطري الأقمشة لملابس حديثي الولادة (الجلد حسّاس)

## 📋 جدول قرار سريع

\`\`\`
هل في المنزل أطفال < 3 سنوات أو حيوانات؟
├── نعم
│   ├── أرضيات → AYLUX/DIOX منظف عام
│   ├── حمّامات → AYLUX منظف حمّام (شطف مزدوج)
│   └── غسيل → DIOX سائل غسيل
└── لا
    ├── كل منتج معتمد آمن
    └── اتّبع تعليمات العبوة
\`\`\`

---

**هل تدير حضانة أو مدرسة؟** نوفّر **شهادات الأمان (SDS)** لكلّ منتج بطلب البريد. [اطلب SDS الآن](mailto:info@karahoca.com).`,
      en: `If you have a child under two or a pet, every cleaning product you use ends up in their mouth somehow — through the floor, carpet, or surfaces they touch with hands/paws.

## ⚠️ 7 ingredients to avoid

### 1. **Sodium Hypochlorite** (chlorine bleach)
Burns skin and eyes. Particularly dangerous for cats — its vapours damage their small lungs.

### 2. **Ammonia**
Irritates the respiratory system. Fatal if mixed with chlorine (produces chloramine gas).

### 3. **Glycol Ethers**
Found in cheap glass cleaners. Affects kidneys with continued inhalation.

### 4. **Triclosan**
An old antibacterial. Banned in EU and US because it disrupts gland development in children.

### 5. **Phthalates**
Found in added "fragrance". Linked to hormonal disruption.

### 6. **Formaldehyde**
Used as a preservative in older products. WHO-classified carcinogen.

### 7. **2-Butoxyethanol**
In industrial floor cleaners. Damages red blood cells.

## ✅ Safe ingredients when used correctly

| Ingredient | Use | Safety |
|-----------|----------|--------|
| **Sodium Lauryl Sulfate** | General cleaner | Safe once dry |
| **Citric Acid** | Limescale | Very safe (found in fruit) |
| **Hydrogen Peroxide 3%** | Sterilising | Breaks down into water + oxygen |
| **Plant-based Surfactants** | Laundry | EU certified |

## 🐱 Pet specifics

**Cats are more sensitive than dogs** because:
- They constantly lick their paws
- They groom themselves with their tongue
- Their liver doesn't break down some phenolic compounds

**Particularly avoid for cats:**
- ❌ Phenol and Pine Sol
- ❌ Tea Tree Oil (toxic to cats even in small amounts)
- ❌ Strong acidic floor cleaners

**For dogs:**
- Generally safe with regular household cleaners after drying
- Keep them away during use
- Never use Xylitol (in some hand sanitisers) — lethal for dogs

## 👶 Child specifics

Under-two children touch everything with their mouth. The rule:
- **Rinse thoroughly** after every clean (two passes with clean water)
- **Wait for complete drying** before bringing them back to the room
- **Storage out of reach** — in a high closed cabinet

## 🌿 Safe KARAHOCA products

Our formulations follow **EU REACH** and **AGRI-EU** regulations:

### Floors (safe for children and pets after drying):
- **AYLUX General Cleaner** — pH 7.5, phthalate-free
- **DIOX General Cleaner** — Plant-based surfactants

### Bathrooms:
- **AYLUX Bathroom Cleaner** — mild acidic (citric acid)
- ⚠️ Don't use bleach in a bathroom a child or cat enters

### Laundry:
- **DIOX Liquid Detergent** — suitable for children's clothes
- ⚠️ Skip fabric softener for newborn clothes (sensitive skin)

## 📋 Quick decision flow

\`\`\`
Are there kids < 3 or pets at home?
├── Yes
│   ├── Floors → AYLUX/DIOX General Cleaner
│   ├── Bathrooms → AYLUX Bathroom Cleaner (double rinse)
│   └── Laundry → DIOX Liquid Detergent
└── No
    ├── Any certified product is safe
    └── Follow package instructions
\`\`\`

---

**Running a daycare or school?** We provide **Safety Data Sheets (SDS)** for every product on email request. [Request SDS now](mailto:info@karahoca.com).`,
      tr: `Eğer evde 2 yaşın altında bir çocuk veya evcil hayvan varsa, kullandığınız her temizlik ürünü bir şekilde ağızlarına ulaşır — yer, halı ya da elleriyle/patileriyle dokundukları yüzeyler aracılığıyla.

## ⚠️ Kaçınılması gereken 7 bileşen

### 1. **Sodyum Hipoklorit** (klor)
Cilt ve gözleri yakar. Kediler için özellikle tehlikeli — buharları küçük akciğerlerine zarar verir.

### 2. **Amonyak**
Solunum sistemini tahriş eder. Klorla karışırsa öldürücü (kloramin gazı oluşur).

### 3. **Glikol Eterler**
Ucuz cam temizleyicilerde bulunur. Sürekli solunmada böbreklere zarar verir.

### 4. **Triklosan**
Eski bir antibakteriyel. AB ve ABD'de çocuklarda bez gelişimini bozduğu için yasaklı.

### 5. **Ftalatlar**
Eklenen "parfüm"de bulunur. Hormonal bozukluklarla ilişkili.

### 6. **Formaldehit**
Eski ürünlerde koruyucu olarak kullanılır. WHO sınıflandırmasında kanserojen.

### 7. **2-Bütoksietanol**
Endüstriyel zemin temizleyicilerinde. Kırmızı kan hücrelerine zarar verir.

## ✅ Doğru kullanıldığında güvenli bileşenler

| Bileşen | Kullanım | Güvenlik |
|---------|----------|----------|
| **Sodyum Lauril Sülfat** | Genel temizlik | Kuruyunca güvenli |
| **Sitrik Asit** | Kireç çözücü | Çok güvenli (meyvelerde mevcut) |
| **Hidrojen Peroksit %3** | Sterilizasyon | Su + oksijene parçalanır |
| **Bitkisel sürfaktanlar** | Çamaşır | EU sertifikalı |

## 🐱 Evcil hayvan özellikleri

**Kediler köpeklerden daha hassastır** çünkü:
- Sürekli patilerini yalıyorlar
- Tüylerini diliyle temizliyor
- Karaciğeri bazı fenolik bileşikleri parçalayamıyor

**Kediler için özellikle kaçınılacaklar:**
- ❌ Fenol ve Pine Sol
- ❌ Çay ağacı yağı (küçük miktarda bile toksik)
- ❌ Güçlü asitli zemin temizleyiciler

**Köpekler için:**
- Standart ev temizleyicileri kuruduktan sonra genelde güvenli
- Kullanım sırasında uzak tutun
- Ksilitol (bazı el dezenfektanlarında) — köpekler için öldürücü

## 👶 Çocuk özellikleri

2 yaş altı çocuklar her şeye ağzıyla dokunur. Kural:
- **İyice durulayın** her temizlikten sonra (iki kez temiz suyla)
- **Tam kurumayı bekleyin** çocuğu odaya geri getirmeden önce
- **Erişimin dışında saklayın** — yüksek kapalı dolapta

## 🌿 Güvenli KARAHOCA ürünleri

Formüllerimiz **EU REACH** ve **AGRI-EU** yönetmeliklerine uyar:

### Zeminler (kuruduktan sonra çocuk ve evcil hayvanlara güvenli):
- **AYLUX Genel Temizleyici** — pH 7.5, ftalat içermez
- **DIOX Genel Temizleyici** — Bitkisel sürfaktanlar

### Banyolar:
- **AYLUX Banyo Temizleyici** — hafif asitli (sitrik asit)
- ⚠️ Çocuk veya kedi giren banyoda klor kullanmayın

### Çamaşır:
- **DIOX Sıvı Deterjan** — çocuk kıyafetlerine uygun
- ⚠️ Yenidoğan kıyafetlerinde yumuşatıcı kullanmayın (cilt hassas)

## 📋 Hızlı karar şeması

\`\`\`
Evde < 3 yaş çocuk veya evcil hayvan var mı?
├── Evet
│   ├── Zeminler → AYLUX/DIOX Genel Temizleyici
│   ├── Banyolar → AYLUX Banyo Temizleyici (çift durulama)
│   └── Çamaşır → DIOX Sıvı Deterjan
└── Hayır
    ├── Onaylı her ürün güvenli
    └── Ambalaj talimatlarını izleyin
\`\`\`

---

**Kreş veya okul mu işletiyorsunuz?** Her ürün için **Güvenlik Bilgi Formu (SDS)** sağlıyoruz. [Şimdi SDS isteyin](mailto:info@karahoca.com).`,
      ru: `Если в доме ребёнок до двух лет или питомец, каждое чистящее средство тем или иным образом попадает им в рот — через пол, ковёр или поверхности, к которым они прикасаются руками/лапами.

## ⚠️ 7 ингредиентов, которых стоит избегать

### 1. **Гипохлорит натрия** (хлор)
Обжигает кожу и глаза. Особенно опасен для кошек — пары вредят их маленьким лёгким.

### 2. **Аммиак**
Раздражает дыхательную систему. Смертелен в смеси с хлором (образует хлорамин).

### 3. **Гликолевые эфиры**
Часты в дешёвых средствах для стёкол. Поражают почки при длительном вдыхании.

### 4. **Триклозан**
Старый антибактериальный. Запрещён в ЕС и США — нарушает развитие желёз у детей.

### 5. **Фталаты**
Содержатся в добавленных «ароматах». Связаны с гормональными нарушениями.

### 6. **Формальдегид**
Консервант в старых продуктах. Канцероген по классификации ВОЗ.

### 7. **2-Бутоксиэтанол**
В промышленных средствах для пола. Повреждает эритроциты.

## ✅ Безопасные ингредиенты при правильном использовании

| Ингредиент | Назначение | Безопасность |
|-----------|----------|--------------|
| **Лаурилсульфат натрия** | Общая уборка | Безопасен после высыхания |
| **Лимонная кислота** | Удаление налёта | Очень безопасна (из фруктов) |
| **Перекись водорода 3%** | Дезинфекция | Разлагается до воды + кислорода |
| **Растительные ПАВ** | Стирка | EU certified |

## 🐱 Особенности для животных

**Кошки чувствительнее собак** потому что:
- Постоянно облизывают лапы
- Чистят шерсть языком
- Печень не разлагает некоторые фенольные соединения

**Особенно избегайте для кошек:**
- ❌ Фенол и Pine Sol
- ❌ Масло чайного дерева (токсично даже в малых количествах)
- ❌ Сильные кислотные средства для пола

**Для собак:**
- Стандартные домашние средства обычно безопасны после высыхания
- Удаляйте на время уборки
- Ксилит (в некоторых антисептиках) — смертельный для собак

## 👶 Особенности для детей

Дети до двух всё пробуют ртом. Правило:
- **Тщательно смывайте** после каждой уборки (два прохода чистой водой)
- **Дождитесь полного высыхания** перед возвращением ребёнка в комнату
- **Храните вне досягаемости** — в высоком закрытом шкафу

## 🌿 Безопасные продукты KARAHOCA

Наши формулы соответствуют **EU REACH** и **AGRI-EU**:

### Полы (безопасны для детей и животных после высыхания):
- **AYLUX универсальное** — pH 7.5, без фталатов
- **DIOX универсальное** — растительные ПАВ

### Ванные:
- **AYLUX средство для ванной** — слабокислое (лимонная кислота)
- ⚠️ Не используйте хлор в ванной, куда заходит ребёнок или кошка

### Стирка:
- **DIOX жидкое стиральное** — подходит для детской одежды
- ⚠️ Не используйте кондиционер для одежды новорождённых (чувствительная кожа)

## 📋 Быстрая схема решения

\`\`\`
Есть ли в доме дети < 3 лет или животные?
├── Да
│   ├── Полы → AYLUX/DIOX универсальное
│   ├── Ванные → AYLUX средство (двойное смывание)
│   └── Стирка → DIOX жидкое
└── Нет
    ├── Любой сертифицированный продукт безопасен
    └── Следуйте инструкциям на упаковке
\`\`\`

---

**Управляете детским садом или школой?** Предоставляем **паспорта безопасности (SDS)** для каждого продукта по запросу. [Запросите SDS сейчас](mailto:info@karahoca.com).`,
    },
    author_name: 'فريق KARAHOCA',
    reading_time: 8,
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    id: 'post-stain-removal-cheatsheet',
    slug: 'stain-removal-cheatsheet-by-type',
    category_id: 'cat-cleaning-tips',
    image: '/diox-images/ديوكس مزيل البقع.webp',
    hero_image: '/diox-images/ديوكس مزيل البقع.webp',
    featured: 0,
    tags: ['stains', 'reference', 'cheatsheet'],
    title: {
      ar: 'دليل سريع لإزالة البقع: من القهوة إلى الزيت إلى الدم',
      en: 'Quick Stain Removal Reference: From Coffee to Oil to Blood',
      tr: 'Hızlı Leke Çıkarma Rehberi: Kahveden Yağa Kana',
      ru: 'Быстрый справочник по пятнам: от кофе до масла и крови',
    },
    excerpt: {
      ar: 'احفظ هذا الجدول. مهما كانت البقعة، الحلّ موجود هنا مع التوقيت ودرجة الحرارة الصحيحة.',
      en: 'Save this table. Whatever the stain, the answer is here with the right timing and temperature.',
      tr: 'Bu tabloyu kaydedin. Hangi leke olursa olsun, doğru zamanlama ve sıcaklıkla cevap burada.',
      ru: 'Сохраните эту таблицу. Какое бы пятно ни было — ответ здесь с правильным временем и температурой.',
    },
    body: {
      ar: `**القاعدة الذهبية للبقع:** كلّما تعاملت معها أسرع، كلّما خرجت أسهل. هذا الدليل مرتّب من **أسهل بقعة** إلى **أصعب بقعة**.

## ☕ بقع المشروبات

### القهوة / الشاي
1. **فوراً** اشطف بماء بارد من الجهة الخلفية للقماش
2. ضع نقطتين من سائل غسيل الصحون + ضع الملابس بماء بارد 30 دقيقة
3. اغسل عادياً بـ **DIOX سائل غسيل** على 30°
4. **بقع قديمة**: استخدم **DIOX مزيل بقع** قبل الغسلة

## 🍔 بقع الطعام

### الشحوم والزيوت
1. **رشّ بودرة بيكنغ صودا** على البقعة لـ15 دقيقة (تمتصّ الزيت)
2. أزل البودرة بقطعة قماش جافّة
3. ضع نقطة من سائل غسيل الصحون مباشرة + افرك
4. اغسل بـ **AYLUX سائل غسيل** على 40°

### الكاتشب والصلصة
1. اكشط الزائد بسكين بلاستيكي (لا تستخدم قماش)
2. اشطف بماء بارد من الخلف
3. خفّف خلّاً أبيض + ماء بنسبة 1:1 وضع على البقعة لـ 10 دقائق
4. اغسل عادياً

## 🩸 بقع الجسم

### الدم
**هذه أصعب بقعة.** القاعدة: **لا تستخدم ماءً ساخناً أبداً** — الحرارة تطبخ البروتين ويصبح دائماً.

1. **ماء بارد فقط** — اغمر البقعة فوراً
2. مزيج: 3 ملاعق Hydrogen Peroxide 3٪ + 1 ملعقة سائل غسيل الصحون
3. ضع المزيج على البقعة لـ 5 دقائق
4. اغسل بماء بارد + **DIOX سائل غسيل**

**بقع دم قديمة (أكثر من 48 ساعة):**
- استخدم خميرة الخبز (Active Dry Yeast) — تفرز إنزيمات تكسر البروتين
- اخلط ملعقة خميرة + ماء فاتر + ضع على البقعة ساعة كاملة قبل الغسيل

### العرق (الأصفر تحت الإبط)
1. خلطة: عصير ليمون + بيكنغ صودا = عجينة
2. افرك بفرشاة أسنان قديمة
3. اتركه 30 دقيقة
4. اغسل بـ **DIOX مسحوق أوتوماتيك** على 60° (للقطن فقط)

> **تحذير:** لا تستخدم الكلور على بقع العرق على الأبيض — يحوّلها لصفراء دائمة.

## ✏️ الحبر والصبغة

### الحبر
استخدم **DIOX مزيل بقع** + ماء فاتر — يعمل على جميع أنواع الحبر (جافّ، جلّ، فلوماستر).

### بقع الصبغة (Hair Dye)
1. **خلال 12 ساعة فقط** يمكن إزالتها كاملاً
2. استخدم **DIOX كلور مخفّف 1:4** على الأبيض القطني
3. **لا تستخدم على القطن الملوّن** — يمسح الألوان

## 🎨 بقع الأطفال

### الطبشور والباستيل
- اكشط الزائد + استخدم **AYLUX منظف عام** على بخّاخ

### العلكة (Chewing Gum)
1. **جمّد** القماش في كيس بلاستيك في الفريزر لساعة
2. اكشط العلكة المتجمّدة
3. ضع بقعة الزيت المتبقّية في زبدة الفول السوداني + اكشطها
4. اغسل عادياً

### اللبن المتقايأ (للأطفال الرضّع)
1. اشطف فوراً بماء بارد
2. ضع بيكنغ صودا + خلّ على المنطقة 20 دقيقة (الإنزيمات تحلّل البروتين)
3. اغسل بـ **DIOX سائل غسيل** على 30°

## 📋 جدول مرجعي سريع

| البقعة | الحرارة | المنتج الموصى به |
|--------|---------|------------------|
| قهوة / شاي | 30° بارد | DIOX سائل |
| زيت / شحوم | 40° | AYLUX سائل |
| دم | بارد فقط | Peroxide + DIOX |
| عرق | 60° (قطن) | DIOX مسحوق |
| حبر | بارد | DIOX مزيل بقع |
| لبن أطفال | 30° | DIOX سائل |
| صبغة | بارد | DIOX كلور (أبيض) |

---

**حلّ لجميع البقع في زجاجة واحدة:** [DIOX مزيل بقع](/ar/diox) — تركيبة إنزيمية تفكّك 20+ نوع بقعة بدون فرك مكثّف.`,
      en: `**Golden rule for stains:** the faster you treat them, the easier they come out. This guide is sorted from **easiest** to **hardest** stains.

## ☕ Drink stains

### Coffee / Tea
1. **Immediately** rinse with cold water from the back of the fabric
2. Add two drops of dish soap + soak in cold water for 30 minutes
3. Wash normally with **DIOX Liquid Detergent** at 30°
4. **Old stains**: use **DIOX Stain Remover** before the wash

## 🍔 Food stains

### Grease and oil
1. **Sprinkle baking soda** on the stain for 15 minutes (absorbs oil)
2. Brush off with a dry cloth
3. Apply dish soap directly + rub
4. Wash with **AYLUX Liquid Detergent** at 40°

### Ketchup and sauce
1. Scrape excess with a plastic knife (not cloth)
2. Rinse with cold water from the back
3. Dilute white vinegar + water 1:1 and apply for 10 minutes
4. Wash normally

## 🩸 Body stains

### Blood
**This is the hardest stain.** Rule: **never use hot water** — heat cooks the protein and locks it in.

1. **Cold water only** — submerge immediately
2. Mix: 3 tbsp 3% hydrogen peroxide + 1 tbsp dish soap
3. Apply for 5 minutes
4. Wash in cold water + **DIOX Liquid Detergent**

**Old blood (> 48 hours):**
- Use active dry yeast — secretes protein-breaking enzymes
- Mix a spoon of yeast + warm water + apply for a full hour before washing

### Sweat (yellow under arms)
1. Mix: lemon juice + baking soda = paste
2. Scrub with an old toothbrush
3. Leave for 30 minutes
4. Wash with **DIOX Automatic Powder** at 60° (cotton only)

> **Warning:** Don't use bleach on white sweat stains — turns them permanently yellow.

## ✏️ Ink and dye

### Ink
Use **DIOX Stain Remover** + warm water — works on every ink type (ballpoint, gel, marker).

### Hair dye stains
1. **Only removable within 12 hours**
2. Use **DIOX Chlorine diluted 1:4** on white cotton
3. **Don't use on coloured cotton** — bleaches the colour

## 🎨 Kid stains

### Crayon and pastel
- Scrape excess + use **AYLUX General Cleaner** spray

### Chewing gum
1. **Freeze** the fabric in a plastic bag for an hour
2. Scrape the frozen gum
3. Treat the remaining oil spot with peanut butter + scrape
4. Wash normally

### Spit-up milk (babies)
1. Rinse immediately with cold water
2. Apply baking soda + vinegar for 20 minutes (enzymes break protein)
3. Wash with **DIOX Liquid Detergent** at 30°

## 📋 Quick reference table

| Stain | Temperature | Recommended product |
|--------|---------|------------------|
| Coffee / Tea | 30° cold | DIOX Liquid |
| Oil / Grease | 40° | AYLUX Liquid |
| Blood | Cold only | Peroxide + DIOX |
| Sweat | 60° (cotton) | DIOX Powder |
| Ink | Cold | DIOX Stain Remover |
| Baby milk | 30° | DIOX Liquid |
| Hair dye | Cold | DIOX Chlorine (whites only) |

---

**One bottle, every stain:** [DIOX Stain Remover](/en/diox) — enzymatic formula breaks down 20+ stain types without heavy scrubbing.`,
      tr: `**Lekeler için altın kural:** ne kadar erken müdahale ederseniz o kadar kolay çıkar. Bu rehber **en kolaydan** **en zora** doğru sıralanmıştır.

## ☕ İçecek lekeleri

### Kahve / Çay
1. **Hemen** kumaşın arkasından soğuk suyla durulayın
2. İki damla bulaşık deterjanı + 30 dakika soğuk suda bekletin
3. Normal olarak **DIOX Sıvı Deterjan** ile 30° de yıkayın
4. **Eski lekeler**: yıkamadan önce **DIOX Leke Çıkarıcı** uygulayın

## 🍔 Yemek lekeleri

### Yağ ve gres
1. **Karbonat serpin** 15 dakika (yağı emer)
2. Kuru bezle silin
3. Bulaşık deterjanı doğrudan uygulayın + ovun
4. **AYLUX Sıvı Deterjan** ile 40° de yıkayın

### Ketçap ve sos
1. Plastik bıçakla fazlasını alın (bez değil)
2. Arkadan soğuk suyla durulayın
3. Beyaz sirke + su 1:1 oranında 10 dakika uygulayın
4. Normal olarak yıkayın

## 🩸 Vücut lekeleri

### Kan
**Bu en zor leke.** Kural: **asla sıcak su kullanmayın** — ısı proteini pişirir, kalıcı olur.

1. **Sadece soğuk su** — hemen daldırın
2. Karışım: 3 yemek kaşığı %3 hidrojen peroksit + 1 yemek kaşığı bulaşık deterjanı
3. 5 dakika uygulayın
4. Soğuk suda + **DIOX Sıvı Deterjan** ile yıkayın

**Eski kan (> 48 saat):**
- Aktif kuru maya kullanın — protein parçalayan enzimler salgılar
- Bir kaşık maya + ılık su + yıkamadan önce 1 saat uygulayın

### Ter (koltuk altı sararma)
1. Karışım: limon suyu + karbonat = macun
2. Eski diş fırçasıyla ovun
3. 30 dakika bekletin
4. **DIOX Otomatik Toz** ile 60° de yıkayın (sadece pamuk)

> **Uyarı:** Beyaz ter lekelerine çamaşır suyu kullanmayın — kalıcı sararma yapar.

## ✏️ Mürekkep ve boya

### Mürekkep
**DIOX Leke Çıkarıcı** + ılık su kullanın — her mürekkep türünde çalışır (tükenmez, jel, keçeli).

### Saç boyası lekeleri
1. **Sadece 12 saat içinde** çıkarılabilir
2. Beyaz pamukta **DIOX Klor 1:4 seyreltik** kullanın
3. **Renkli pamuğa kullanmayın** — rengi açar

## 🎨 Çocuk lekeleri

### Mum boya ve pastel
- Fazlasını kazıyın + **AYLUX Genel Temizleyici** sprey

### Sakız
1. Kumaşı plastik torbada **bir saat dondurun**
2. Donmuş sakızı kazıyın
3. Kalan yağ lekesine fıstık ezmesi sürüp kazıyın
4. Normal olarak yıkayın

### Bebek mama kusması
1. Hemen soğuk suyla durulayın
2. 20 dakika karbonat + sirke uygulayın (enzimler proteini parçalar)
3. **DIOX Sıvı Deterjan** ile 30° de yıkayın

## 📋 Hızlı referans tablosu

| Leke | Sıcaklık | Önerilen ürün |
|--------|---------|------------------|
| Kahve / Çay | 30° soğuk | DIOX Sıvı |
| Yağ / Gres | 40° | AYLUX Sıvı |
| Kan | Sadece soğuk | Peroksit + DIOX |
| Ter | 60° (pamuk) | DIOX Toz |
| Mürekkep | Soğuk | DIOX Leke Çıkarıcı |
| Bebek mama | 30° | DIOX Sıvı |
| Saç boyası | Soğuk | DIOX Klor (beyaz) |

---

**Tek şişe, her leke:** [DIOX Leke Çıkarıcı](/tr/diox) — enzim formülü 20+ leke tipini ağır ovma olmadan çıkarır.`,
      ru: `**Золотое правило для пятен:** чем быстрее обработаете, тем легче выйдут. Этот гид отсортирован от **самых простых** к **самым сложным** пятнам.

## ☕ Пятна от напитков

### Кофе / чай
1. **Немедленно** промойте холодной водой с обратной стороны ткани
2. Две капли средства для посуды + замочите в холодной воде на 30 минут
3. Постирайте обычно с **DIOX жидким** при 30°
4. **Старые пятна**: используйте **DIOX пятновыводитель** перед стиркой

## 🍔 Пищевые пятна

### Жир и масло
1. **Посыпьте содой** на 15 минут (впитывает жир)
2. Стряхните сухой тряпкой
3. Нанесите средство для посуды прямо + потрите
4. Постирайте **AYLUX жидким** при 40°

### Кетчуп и соус
1. Пластиковым ножом снимите излишки (не тряпкой)
2. Промойте холодной водой с обратной стороны
3. Разведите белый уксус + вода 1:1, нанесите на 10 минут
4. Постирайте как обычно

## 🩸 Биологические пятна

### Кровь
**Это самое сложное пятно.** Правило: **никогда горячая вода** — она «варит» белок и закрепляет пятно.

1. **Только холодная вода** — погрузите немедленно
2. Смесь: 3 ст. л. 3% перекиси водорода + 1 ст. л. средства для посуды
3. Нанесите на 5 минут
4. Стирка в холодной воде + **DIOX жидкое**

**Старая кровь (> 48 ч):**
- Используйте сухие активные дрожжи — выделяют ферменты, разрушающие белок
- Ложка дрожжей + тёплая вода + нанесите за час до стирки

### Пот (жёлтое под мышками)
1. Смесь: лимонный сок + сода = паста
2. Потрите старой зубной щёткой
3. Оставьте на 30 минут
4. Постирайте **DIOX порошком автомат** при 60° (только хлопок)

> **Предупреждение:** Не используйте хлор на белых пятнах пота — превращает их в стойкое жёлтое.

## ✏️ Чернила и краски

### Чернила
Используйте **DIOX пятновыводитель** + тёплую воду — работает с любым типом чернил (шариковая, гелевая, маркер).

### Краска для волос
1. **Удаляется только в первые 12 часов**
2. Используйте **DIOX хлор, разведённый 1:4** на белом хлопке
3. **Не используйте на цветном хлопке** — обесцветит

## 🎨 Детские пятна

### Мелки и пастель
- Соскребите излишки + **AYLUX универсальное** спрей

### Жевательная резинка
1. **Заморозьте** ткань в пакете в морозилке на час
2. Соскребите замёрзшую резинку
3. Оставшееся масляное пятно обработайте арахисовой пастой + соскребите
4. Постирайте как обычно

### Срыгивания молока (младенцы)
1. Сразу промойте холодной водой
2. Сода + уксус на 20 минут (ферменты разлагают белок)
3. Постирайте **DIOX жидким** при 30°

## 📋 Быстрая справочная таблица

| Пятно | Температура | Рекомендуемое средство |
|--------|---------|------------------|
| Кофе / чай | 30° холодная | DIOX жидкое |
| Масло / жир | 40° | AYLUX жидкое |
| Кровь | Только холодная | Перекись + DIOX |
| Пот | 60° (хлопок) | DIOX порошок |
| Чернила | Холодная | DIOX пятновыводитель |
| Детское молоко | 30° | DIOX жидкое |
| Краска для волос | Холодная | DIOX хлор (белое) |

---

**Один флакон — все пятна:** [DIOX пятновыводитель](/ru/diox) — ферментная формула разлагает 20+ типов пятен без интенсивной чистки.`,
    },
    author_name: 'فريق KARAHOCA',
    reading_time: 9,
  },
];
