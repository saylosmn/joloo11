# 🚗 ЗХД Шалгалт — Монголын замын хөдөлгөөний дүрмийн шалгалтын апп

Монгол Улсын жолооны үнэмлэхний замын хөдөлгөөний дүрмийн шалгалтад бэлдэх **mobile-first** апп.
800 асуулт, 36 бүлэг, бүгд зурагтай. Бүлгээр давтаж, жинхэнэ шалгалт (20 асуулт / 25 минут) өгнө.

> **Технологи:** Expo (React Native) + Expo Router · FastAPI · MongoDB · Google Sign-In · QPay · Telegram админ бот

---

## Онцлог боломжууд

- **Google-ээр нэвтрэх** (өөрийн OAuth client) + давхцахгүй профайл нэр (real-time шалгалт)
- **Бүлгээр давтах** — 36 бүлэг, гүйцэтгэлийн progress bar, хариулсан даруйд зөв/буруу нь өнгө + icon + haptic
- **Бүлэг хайх** — 33 бүлгээс нэрээр нь шүүх
- **Дасгал үргэлжлүүлэх** — бүлэг бүрт хамгийн сүүлд үзсэн асуултаас үргэлжилнэ (утсан дээр хадгална)
- **Шалгалт** — санамсаргүй 20 асуулт, 25 минутын тоолуур, автомат дүгнэлт, буруу хариултын жагсаалт
- **Шалгалт үргэлжлүүлэх** — асуулт, цаг, хариулт сервер дээр хадгалагдана; апп унасан ч алдагдахгүй
- **Өнгөрсөн шалгалтын дэлгэрэнгүй** — түүхэн дэх шалгалт бүр дээр дарж бүрэн задаргаа (зөв/буруу шүүлт) харах
- **Дүн хуваалцах** — шалгалтын үр дүнгээ хуваалцах
- **Streak ба өдрийн зорилго** — дараалан суралцсан өдөр + өдрийн асуултын зорилго
- **Алдаатай асуултын горим** (PRO) ба **тэмдэглэсэн** асуултууд
- **Статистик** — нийт хариулсан, зөв хувь, бүлгийн гүйцэтгэл, streak, сүүлийн 10 шалгалт
- **Асуулт руу шууд шилжих grid**, зурагтай асуултууд (замын тэмдэг)
- **Гэрэл / бараан горим**
- **Free / PRO** хувилбар (доор)
- **QPay төлбөр** — аппаас шууд PRO худалдаж авах (QR + банкны апп deeplink, автомат баталгаажуулалт)
- **Дансаар шилжүүлэх** — мерчант гэрээгүйгээр: хувийн QR + гүйлгээний код, Telegram-аар нэг товчоор баталгаажуулах
- **Telegram админ бот** — профайл нэрээр PRO идэвхжүүлэх

## Free ба PRO

| | Free | PRO |
|---|---|---|
| Бүлгээр давтах | Эхний 2 бүлэг | Бүх 36 бүлэг |
| Өдрийн асуулт | 30 / өдөр | Хязгааргүй |
| Шалгалт | 1 / өдөр | Хязгааргүй |
| Алдаатай асуултын горим | ✕ | ✓ |
| Статистик | Энгийн | Дэлгэрэнгүй |

---

## Төслийн бүтэц

```
/app
├── backend/                 # FastAPI + MongoDB + Telegram bot
│   ├── server.py            # Бүх REST API, QPay төлбөр, Telegram webhook, статик зураг
│   ├── qpay_client.py       # QPay v2 async client (auth/refresh, invoice, payment check)
│   ├── data/
│   │   ├── ZHD_800.xlsx      # Эх Excel (repo-д ordоггүй)
│   │   ├── images/           # Асуултаас задалсан зургууд (backend-ээс дамжина)
│   │   └── image_map.json    # Асуулт № → зургийн файл
│   └── scripts/
│       ├── seed.py           # Excel унших + validation + seed
│       └── skipped_rows.json # Алдаатай/алгассан мөрийн тайлан
└── frontend/                # Expo Router апп
    ├── app/                  # Дэлгэцүүд (file-based routing)
    ├── src/                  # theme, api, auth, компонентууд
    └── assets/fonts/         # Manrope (Кирилл дэмждэг)
```

---

## Локал суулгах

### Backend
MongoDB локалд ажиллаж байх шаардлагатай (`mongodb://localhost:27017`).
Windows дээр: `winget install MongoDB.Server` — Windows үйлчилгээ болж суудаг.

```bash
cd backend
pip install -r requirements-dev.txt   # серверт зөвхөн requirements.txt хэрэгтэй
cp .env.example .env                  # дараа нь утгуудыг бөглөнө
uvicorn server:app --host 0.0.0.0 --port 8000
```

> `requirements.txt` нь ажиллахад хэрэгтэй **9 багц** — deploy хурдан байлгах үүднээс.
> Тест, Excel скрипт, linter нь `requirements-dev.txt` дотор.

> **Auto-seed:** Server эхлэхэд DB хоосон бол `data/categories.json` + `data/questions.json`-оос
> **автоматаар seed** хийнэ (800 асуулт / 36 бүлэг / 800 зураг). Тиймээс шинэ deploy дээр гараар
> seed хийх шаардлагагүй — асуултын дата болон зургууд repo-д хамт орсон.
> `scripts/seed.py` (Excel-ээс) хэвээр байгаа ба `scripts/export_*`-аар шинэ Excel-ээс JSON
> дахин үүсгэж болно. Өдрийн хязгаарын reset нь **Монголын цагаар (UTC+8)** ажиллана.

### Frontend
```bash
cd frontend
npm install
npx expo start                 # QR кодоор утсан дээрээ нээнэ
npx expo start --web           # эсвэл хөтөч дээр
```

`frontend/.env`:
```
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=...apps.googleusercontent.com
```

> Утсан дээрээ турших бол `localhost` ажиллахгүй — компьютерийнхээ LAN IP-г
> бичнэ (ж: `http://192.168.1.15:8000`), backend-ээ `--host 0.0.0.0`-оор асаана.
Бүх API дуудлага `EXPO_PUBLIC_BACKEND_URL` дээр `/api` угтвартайгаар явна.

---

## Excel-ээс асуулт импортлох

Шинэ Excel ирвэл нэг командаар бүх асуулт, бүлэг, зургийг солино:

```bash
python backend/scripts/import_xlsx.py <workbook.xlsx> --dry-run   # эхлээд шалгах
python backend/scripts/import_xlsx.py <workbook.xlsx>             # дараа нь бичих
python backend/scripts/seed_from_json.py --force                  # DB-г шинэчлэх
```

Скрипт нь `Асуултууд` хуудсыг уншиж, мөр бүрт холбогдсон зургийг гаргаж аваад
`data/categories.json`, `data/questions.json`, `data/image_map.json`, `data/images/`
-ийг дахин бичнэ.

**Бүх мөр шалгалт давахаас нааш юу ч бичихгүй** — эвдэрсэн Excel өгөгдлийг
хагас дутуу орлуулах боломжгүй. Шалгадаг зүйлс:

- № нь тоо мөн эсэх, асуулт/сонголт/бүлэг хоосон биш эсэх
- Зөв хариулт нь А/Б/В/Г-ийн нэг мөн эсэх
- № давхардаагүй, бүлэггүй асуулт байхгүй эсэх
- `category_id` давхардаагүй (өмнөх экспортод энэ алдаа гарч байсан)
- `Хураангуй` хуудас байвал бүлэг бүрийн асуултын тоо түүнтэй таарч байгаа эсэх

Хүснэгтийн багана: `№ | Бүлэг | Асуулт | Зураг | А | Б | В | Г | Зөв хариулт | Тайлбар | Зургийн файл`

**Хамгийн сүүлийн импорт:** 800 асуулт, 36 бүлэг, 800 зураг, 0 алдаа.
Хариултын хуваарилалт А/Б/В/Г = 200/200/200/200.

---


## QPay төлбөр (PRO худалдан авалт)

Хэрэглэгч аппаас шууд **QPay**-ээр PRO эрхээ авна. QPay v2 merchant API-г backend дотроос
(`backend/qpay_client.py`, httpx дээр суурилсан async client) дууддаг — merchant нэр/нууц үг
**зөвхөн backend дээр** байна, апп руу хэзээ ч дамжихгүй.

**1) Тохиргоо** — `backend/.env`:
```
QPAY_HOST=https://merchant.qpay.mn/v2/     # sandbox: https://merchant-sandbox.qpay.mn/v2/
QPAY_USERNAME=<merchant username>
QPAY_PASSWORD=<merchant password>
QPAY_INVOICE_CODE=<нэхэмжлэхийн код>
PRO_PRICE_MNT=19900
PRO_PRODUCT_NAME=ЗХД Шалгалт PRO
PUBLIC_URL=https://your-backend-host       # callback үүн рүү ирнэ, заавал бөглөнө
```
Эдгээрийн аль нэг нь дутуу бол `GET /api/payments/plan` нь `enabled: false` буцаах ба апп дээр
QPay товч харагдахгүй — Telegram-аар гараар идэвхжүүлэх арга хэвээр үлдэнэ.

**Мөнгө аль данс руу орох вэ?** Deeplink дотор данс бичигддэггүй — deeplink бол зүгээр л
нэхэмжлэхийг банкны апп руу нээх холбоос. Данс нь **нэхэмжлэх дээр** тодорхойлогдоно:

- Default: merchant гэрээнд бүртгэлтэй үндсэн данс руу орно. Юу ч тохируулах шаардлагагүй.
- Тусгай данс руу оруулах бол `.env`-д гурвуулаа бөглөнө — тэгвэл нэхэмжлэх дээр
  `transactions[].accounts[]` нэмэгдэнэ:
  ```
  QPAY_ACCOUNT_BANK_CODE=<банкны код>
  QPAY_ACCOUNT_NUMBER=<дансны дугаар>
  QPAY_ACCOUNT_NAME=<дансны нэр>
  ```
  QPay нь дурын данс хүлээж авдаггүй — тухайн данс таны merchant-д бүртгэлтэй байх ёстой.
  Өөрөөр хэлбэл энэ нь merchant гэрээг тойрох арга биш.

**2) Урсгал**

1. `POST /api/payments/create` → QPay дээр нэхэмжлэх үүсгэж, `payments` цуглуулгад `NEW` төлөвтэй хадгална.
   Хариуд нь QR зураг (base64), QR текст, богино URL, банкны deeplink-ууд ирнэ.
   Хэрэглэгчид нээлттэй `NEW` нэхэмжлэх байвал шинээр үүсгэлгүй түүнийг эргүүлж өгнө.
2. Апп QR-г харуулж, банкны апп руу үсрэх товчуудыг гаргана (`QPayModal`).
3. Төлбөр төлөгдмөгц QPay нь `{PUBLIC_URL}/api/payments/qpay/callback?payment_id=...` руу дуудна.
   Зэрэгцээгээр апп 3 секунд тутам `GET /api/payments/{payment_id}` дуудаж шалгана.
4. Аль ч зам ороод ирсэн төлбөрийг **QPay-ийн `payment/check`-ээр дахин баталгаажуулж** байж
   `PAID` болгож, `isPro = true` тавина. Хоёр удаа орж ирсэн ч атомик `find_one_and_update`
   тул PRO нэг л удаа олгогдоно.

> callback дахь `payment_id` нь зөвхөн хайх түлхүүр. Төлөгдсөн эсэхийг хэзээ ч callback-ийн
> агуулгад итгэж шийддэггүй, үргэлж QPay-ээс шалгана.

**3) Тест** — sandbox host-оор `QPAY_HOST`-оо солиод шалгана. QPay-ийн callback нь интернетээс
хандах боломжтой `PUBLIC_URL` шаардана (локал дээр туннель ашиглана); туннель байхгүй бол апп
өөрөө polling хийдэг тул урсгал ажиллана.

---

## Дансаар шилжүүлэх (мерчант гэрээгүйгээр)

QPay API нь **мерчант гэрээ** шаарддаг ([эхлэх заавар](https://www.qpay.mn/gettingstart)). Гэрээ
аваагүй бол энэ горимоор өөрийн данс руугаа шууд орлого авч болно. Ялгаа нь: банкны API-гүй тул
төлбөр орсныг сервер өөрөө мэдэхгүй — **та Telegram дээр нэг товч дарж баталгаажуулна**.

**1) Тохиргоо** — `backend/.env`:
```
BANK_NAME=Хаан банк
BANK_ACCOUNT_NUMBER=5041234567
BANK_ACCOUNT_NAME=Б. БАТ
BANK_QR_FILE=my_qr.png        # заавал биш; backend/data/ дотор байрлуулна
TELEGRAM_BOT_TOKEN=...        # заавал
TELEGRAM_ADMIN_ID=...         # заавал
```
`BANK_QR_FILE` нь банкны аппаасаа хадгалсан **хувийн QR** зураг. Гурван дансны талбар дутуу бол
энэ горим идэвхгүй болж, апп дээр товч харагдахгүй.

**2) Урсгал**

1. `POST /api/payments/bank/create` → давтагдашгүй **гүйлгээний код** (`ZHD-4F7KP`) үүснэ.
   Код нь 0/O/1/I/L зэрэг андуурмаар тэмдэгт агуулахгүй.
   Нээлттэй хүсэлт байвал шинээр үүсгэлгүй хуучин кодыг нь хэвээр буцаана.
2. Апп нь QR, дансны дугаар, хүлээн авагч, дүн, кодыг хуулж болохоор харуулна.
3. Хэрэглэгч шилжүүлээд «Шилжүүлсэн» дарна → `POST /api/payments/bank/{id}/claim` → төлөв `PENDING`.
4. Танд Telegram-аар мэдэгдэл ирнэ: хэрэглэгч, дүн, код + **✅ Зөвшөөрөх / ❌ Татгалзах** товч.
   Дансаа хараад нэг товч дарна. Товч дарсны дараа мессеж үр дүнгээр солигдоно (хоёр дарагдахгүй).
5. Зөвшөөрөх → `isPro = true`. Апп 4 секунд тутам шалгаж байгаад автоматаар PRO болно.
   Татгалзах → хэрэглэгчид «Шилжүүлэг олдсонгүй» гэж харуулж, дахин оролдох боломж өгнө.

`/pending` команд бичвэл баталгаажаагүй бүх хүсэлтийг товчтой нь дахин гаргана.

> Хэрэглэгчийн «Шилжүүлсэн» товч юу ч олгодоггүй — зөвхөн танд мэдэгдэл явуулна.
> PRO эрх зөвхөн таны товчоор идэвхжинэ.

---

## Google Sign-In тохируулах

Нэвтрэлт нь **өөрийн** Google OAuth client дээр ажиллана — гуравдагч платформ
оролцохгүй. Апп Google-ээс ID token авч backend руу илгээнэ, backend нь түүнийг
Google-ийн нийтэлсэн түлхүүрээр шалгаад **өөрийн** сесс токен өгнө.

**1. Google Cloud Console дээр client үүсгэх**

[console.cloud.google.com](https://console.cloud.google.com/) → төсөл үүсгэх →
**APIs & Services → OAuth consent screen** бөглөх → **Credentials → Create
credentials → OAuth client ID**. Гаргах платформ бүрт нэгийг үүсгэнэ:

| Төрөл | Хэзээ хэрэгтэй вэ | Тохируулах зүйл |
|---|---|---|
| **Web application** | Заавал (веб болон Expo Go хоёулаа үүнийг ашиглана) | Authorized redirect URI: `https://auth.expo.io/@<expo-хэрэглэгч>/zhd-shalgalt` ба `http://localhost:8081` |
| **Android** | APK/Play Store гаргах бол | Package: `mn.zhdshalgalt.app`, SHA-1 гарын үсэг |
| **iOS** | App Store гаргах бол | Bundle ID: `mn.zhdshalgalt.app` |

> Bundle ID / package нэрийг `frontend/app.json`-оос өөрчилж болно. Гэхдээ Google
> дээрх client-ээ ч хамт шинэчлэхээ мартуузай.

**2. Client ID-нуудаа тавих**

`backend/.env`:
```
GOOGLE_CLIENT_ID_WEB=...apps.googleusercontent.com
GOOGLE_CLIENT_ID_IOS=...apps.googleusercontent.com      # заавал биш
GOOGLE_CLIENT_ID_ANDROID=...apps.googleusercontent.com  # заавал биш
```

`frontend/.env`:
```
EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=...apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=...apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=...apps.googleusercontent.com
```

Backend дээр зөвхөн **client ID** хадгална — client secret хэрэггүй, хэзээ ч
энд бичих шаардлагагүй.

**3. Хэрхэн ажилладаг вэ**

```
Апп ──Google-ээр нэвтрэх──> Google ──id_token──> Апп
Апп ──POST /api/auth/google {id_token}──> Backend
Backend ──түлхүүр шалгах──> googleapis.com/oauth2/v3/certs (кэштэй)
Backend ──session_token──> Апп   (30 хоног, өөрийн токен)
```

Хэрэглэгчийг Google-ийн `sub` талбараар таньдаг — и-мэйл өөрчлөгдсөн ч данс
андуурагдахгүй. `GOOGLE_CLIENT_ID_WEB` хоосон бол нэвтрэх товч идэвхгүй болж,
шалтгааныг нь дэлгэцэн дээр бичнэ.

---

## Telegram админ бот

Бот backend дотор **webhook** хэлбэрээр ажиллана.

- Зөвхөн `TELEGRAM_ADMIN_ID`-тай тэнцүү Telegram ID-тай хүнээс команд хүлээн авна. Бусад хүнд «эрх байхгүй» гэж хариулна.
- Профайл нэрийг **том/жижиг үсгээр ялгалгүй** хайна.

**Командууд:**
| Команд | Үйлдэл |
|---|---|
| `<profileName>` эсвэл `/pro <name>` | PRO идэвхжүүлэх |
| `/unpro <name>` | PRO цуцлах |
| `/check <name>` | төлөв, бүртгүүлсэн огноо, статистик |
| `/list` | PRO хэрэглэгчдийн жагсаалт |
| `/pending` | баталгаажаагүй шилжүүлгүүдийг товчтой нь дахин гаргах |
| `/stats` | хэрэглэгч, өнөөдрийн идэвх, орлогын тойм |

**Webhook холбох:** `.env`-д `PUBLIC_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` бөглөөд backend ажиллаж байх үед нэг удаа дуудна:
```
GET  {PUBLIC_URL}/api/telegram/set-webhook
```
Энэ нь Telegram-ийн webhook-ыг `{PUBLIC_URL}/api/telegram/webhook` руу заана.

PRO идэвхжсэн даруйд апп дахь профайл дэлгэц polling-оор автоматаар шинэчлэгдэнэ (refresh шаардахгүй).

---

## API (гол endpoint-ууд)

Бүгд `/api` угтвартай. Хамгаалалттай endpoint-ууд `Authorization: Bearer <session_token>` шаардана.

- `POST /auth/google` · `GET /auth/me` · `POST /auth/logout`
- `GET /profile/check-name?name=` · `POST /profile/set-name`
- `GET /categories` · `GET /categories/{id}/questions`
- `POST /practice/answer` · `POST /questions/{id}/bookmark`
- `GET /questions/wrong` (PRO) · `GET /questions/bookmarked`
- `GET /exam/start` · `GET /exam/active` · `POST /exam/answer` · `POST /exam/abandon`
- `POST /exam/submit` · `GET /attempts`
- `GET /stats` · `GET /me/limits`
- `GET /payments/plan` · `POST /payments/create` · `GET /payments/{payment_id}` · `GET /payments`
- `POST|GET /payments/qpay/callback?payment_id=` (QPay дуудна)
- `GET /payments/bank/info` · `GET /payments/bank/qr` · `POST /payments/bank/create` · `POST /payments/bank/{id}/claim`
- `POST /telegram/webhook` · `GET /telegram/set-webhook` · `GET /health`

---

## Шалгалтын сесс

Шалгалтын асуултын багц, цаг, хариултууд **сервер дээр** хадгалагдана. Апп унах,
утас унтрах, санамсаргүй гарах — аль нь ч шалгалтыг алдагдуулахгүй.

| Endpoint | Үүрэг |
|---|---|
| `GET /exam/start` | Идэвхтэй сесс байвал **үргэлжлүүлнэ**, үгүй бол шинээр үүсгэнэ |
| `GET /exam/active` | Юу ч эхлүүлэхгүйгээр дуусаагүй шалгалт байгаа эсэхийг хэлнэ |
| `POST /exam/answer` | Хариулт бүрийг шууд хадгална (autosave) |
| `POST /exam/submit` | `session_id`-аар дүгнэнэ |
| `POST /exam/abandon` | Дүгнэлгүйгээр цуцална |

**Чухал нарийвчлалууд:**

- Шалгалт **эхлэхэд** өдрийн эрхээс тоологдоно. Тиймээс үргэлжлүүлэх нь дахин
  тоологдохгүй — `GET /exam/start` нь идэвхтэй сессээ буцаана.
- Цаг дуусахад дараагийн хандалт дээр **хадгалагдсан хариултаар автоматаар дүгнэгдэнэ**.
  Хугацаа дууссан шалгалт хэзээ ч тодорхойгүй төлөвт үлдэхгүй.
- Хоёр удаа илгээхэд хоёр дахин дүгнэгдэхгүй — `finalize_session` нь атомик claim
  ашиглаж, аль хэдийн дүгнэгдсэн бол ижил `attempt`-ыг буцаана.
- Цуцлах нь өдрийн эрхийг **буцаахгүй** — аппд ч үүнийг тодорхой бичсэн.
- `session_id`-гүй хуучин API хэвээр ажиллана (`answers` жагсаалт илгээх хэлбэр).

---

## Тест

**Offline багц** (интернэт, MongoDB, QPay аль нь ч хэрэггүй). Санах ойн Mongo болон
stub QPay сервер ашиглан бүтэн урсгалыг шалгана:

```bash
pip install -r backend/requirements-dev.txt
python backend/tests/offline/run_all.py
```

| Багц | Хамрах хүрээ |
|---|---|
| `test_qpay_client.py` | QPay v2 client — token cache/refresh, нэхэмжлэх, төлбөр шалгах, буруу нууц үг |
| `test_qpay_flow.py` | QPay бүтэн урсгал, хуурамч callback-аас хамгаалалт, давхар нэхэмжлэх үүсгэхгүй байх |
| `test_bank_flow.py` | Дансаар шилжүүлэх, Telegram баталгаажуулалт, эрхгүй хүн товч дарах, давхар зөвшөөрөл |
| `test_core_flow.py` | Free/PRO хязгаар, шалгалтын урсгал, бүлгийн ахиц, индекс, цэвэрлэгээ |
| `test_exam_session.py` | Сесс үргэлжлүүлэх, autosave, хугацаа дуусах, цуцлах, давхар илгээх |
| `test_admin_bot.py` | Telegram командууд, эрхийн шалгалт, тайлангийн тоонууд |
| `test_google_auth.py` | ID token шалгалт, хугацаа/аудиенц/гарын үсэг, сесс гаргах, гарах |

**Онлайн багц** — `backend/tests/test_backend.py` нь ажиллаж буй backend рүү HTTP-ээр
ханддаг. Хаягийг `BACKEND_URL` орчны хувьсагчаар, эсвэл `frontend/.env`-ээс уншина;
аль нь ч байхгүй бол алдаа өгөхгүй, алгасна.

```bash
BACKEND_URL=https://your-backend pytest backend/tests/test_backend.py
```

**Frontend:**
```bash
cd frontend && npx tsc --noEmit && npx eslint app src --ext .ts,.tsx
```

---

## Android APK бэлдэх

> **Дараалал чухал.** `EXPO_PUBLIC_*` хувьсагчид нь build хийх мөчид код дотор
> шигтгэгддэг — APK гарсны дараа солих боломжгүй. Тиймээс эхлээд backend болон
> Google OAuth-оо бэлэн болгоод, дараа нь угсарна.

### 1. Урьдчилсан нөхцөл

| Юу | Яагаад |
|---|---|
| Backend интернэтэд гарсан байх | `localhost` нь утсан дээр **утас өөрөө** гэсэн үг. Render дээр deploy хийсэн байх ёстой. |
| Google **Android** OAuth client | Android дээр `androidClientId` **заавал** шаардлагатай — үгүй бол нэвтрэх товч идэвхгүй. |
| Google **Web** OAuth client | Веб хувилбарт болон Expo Go-д хэрэглэгдэнэ. |

### 2. Google дээр Android client үүсгэх

Android client-д **гарын үсгийн SHA-1** хэрэгтэй. EAS өөрөө keystore үүсгэдэг тул
эхлээд нэг удаа credentials үүсгээд SHA-1-ээ авна:

```bash
cd frontend
npx eas-cli login
npx eas-cli credentials -p android
```
`Keystore: Set up a new keystore` сонгоод, гарсан **SHA1 Fingerprint**-ыг хуулна.

Дараа нь Google Cloud Console → **Credentials → Create OAuth client ID → Android**:

| Талбар | Утга |
|---|---|
| Package name | `mn.zhdshalgalt.app` |
| SHA-1 certificate fingerprint | дээрх EAS-ээс авсан утга |

> Package нэрийг `frontend/app.json` → `expo.android.package`-ээс өөрчилж болно.
> Өөрчилвөл Google дээрх client-ээ ч заавал шинэчилнэ.

### 3. `frontend/.env` бөглөх

```
EXPO_PUBLIC_BACKEND_URL=https://<таны-service>.onrender.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=...apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=...apps.googleusercontent.com
```

Мөн эдгээрийг EAS-ийн серверт ч хүргэх хэрэгтэй (build нь үүлэн дээр явдаг тул
локал `.env` тийшээ очихгүй):

```bash
npx eas-cli env:create --name EXPO_PUBLIC_BACKEND_URL --value https://... --environment preview
npx eas-cli env:create --name EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB --value ... --environment preview
npx eas-cli env:create --name EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID --value ... --environment preview
```

### 4. APK угсрах

```bash
cd frontend
npx eas-cli build -p android --profile preview
```

`preview` профайл нь **APK** гаргадаг (`eas.json` дотор тохируулсан) — шууд
суулгаж туршихад тохиромжтой. Build дуусахад Expo татаж авах линк өгнө.

Play Store-д тавихдаа `production` профайлыг ашиглана — тэр нь **AAB** гаргаж,
`versionCode`-ыг автоматаар нэмэгдүүлнэ:

```bash
npx eas-cli build -p android --profile production
```

### 5. Шалгах

APK суулгасны дараа:
1. Нэвтрэх товч **идэвхтэй** байх ёстой. Идэвхгүй бол `EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID`
   EAS орчинд хүрээгүй байна.
2. Google-ээр нэвтрэхэд `mn.zhdshalgalt.app:/oauthredirect` руу буцаж ирнэ.
   «redirect_uri_mismatch» гарвал Google дээрх Android client-ийн package/SHA-1 таарахгүй байна.
3. Асуулт ачаалагдахгүй бол `EXPO_PUBLIC_BACKEND_URL` буруу, эсвэл Render унтарсан
   (үнэгүй багц 15 минутын дараа унтардаг, эхний хүсэлт ~50 секунд).

### Локал Gradle build (өөр арга)

Android SDK болон **JDK 17** суусан байх шаардлагатай (шинэ JDK дээр Gradle
амжилтгүй болох магадлалтай):

```bash
cd frontend
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```
APK: `frontend/android/app/build/outputs/apk/release/app-release.apk`

> Энэ нь **debug түлхүүрээр** гарын үсэг зурдаг тул зөвхөн туршихад тохиромжтой.
> Play Store-д EAS-ийг ашиглах нь хамаагүй хялбар.

---

## Deploy — Render + MongoDB Atlas

Render дээр **MongoDB байхгүй** (зөвхөн Postgres, Key-Value). Тиймээс өгөгдлийн санг
MongoDB Atlas-аас авч, backend-ээ Render дээр ажиллуулна. Хоёулаа үнэгүй багцтай.

### 1. MongoDB Atlas (5 минут)

1. [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) дээр бүртгүүлнэ.
2. **Create → M0 (Free)** кластер, бүс: Singapore эсвэл Frankfurt.
3. **Database Access** → хэрэглэгч үүсгэнэ (нэр + нууц үг тэмдэглэж ав).
4. **Network Access** → `0.0.0.0/0` нэмнэ. *(Render-ийн IP тогтмол биш. Тогтмол IP
   хэрэгтэй бол Render-ийн төлбөрт багц дээр static outbound IP авч болно.)*
5. **Connect → Drivers** → холболтын мөрийг хуулна:
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   ```

### 2. Кодоо GitHub дээр тавих

Render нь Git repo-оос deploy хийдэг:

```bash
git init
git add .
git commit -m "ЗХД шалгалт"
git branch -M main
git remote add origin https://github.com/<хэрэглэгч>/<repo>.git
git push -u origin main
```

> `.gitignore` нь `backend/.env`, `frontend/.env`-ийг орхиж, `.env.example`-ийг
> хадгална. Бодит нууц үг GitHub дээр очихгүй.

### 3. Render дээр үүсгэх

**Dashboard → New → Blueprint** → repo-гоо сонгоно. Үндсэн дээр байгаа
[`render.yaml`](render.yaml)-ийг уншаад service-ээ өөрөө тохируулна:

| Тохиргоо | Утга |
|---|---|
| Runtime | Python 3.12 |
| Root directory | `backend` |
| Build | `pip install -r requirements.txt` |
| Start | `uvicorn server:app --host 0.0.0.0 --port $PORT` |
| Health check | `/api/health` |

Дараа нь **Environment** табаас гараар бөглөх зүйлс: `MONGO_URL` (Atlas-ын мөр),
`PUBLIC_URL` (өөрийнх нь хаяг, ж: `https://zhd-shalgalt-api.onrender.com`),
Google client ID-нууд, Telegram/QPay/дансны мэдээлэл. `TELEGRAM_WEBHOOK_SECRET`
автоматаар үүснэ.

### 4. Deploy хийсний дараа

```bash
curl https://<таны-service>.onrender.com/api/health
```

Эхний асаалт дээр 36 бүлэг, 800 асуулт **автоматаар seed** хийгдэнэ (DB хоосон
байвал л; дахин давхардуулахгүй). Дараа нь нэг удаа:

```
GET https://<таны-service>.onrender.com/api/telegram/set-webhook
```

Эцэст нь аппаа шинэ backend рүү заана — `frontend/.env`:
```
EXPO_PUBLIC_BACKEND_URL=https://<таны-service>.onrender.com
```

### Холболтын мөр ажиллахгүй бол

`bad auth : authentication failed` гарвал холболтын мөрөө **локал дээр** шалгана —
нууц үг хаашаа ч явахгүй:

```bash
python backend/scripts/check_mongo.py "<холболтын мөр>"
```

Хамгийн түгээмэл шалтгаанууд:

| Шинж тэмдэг | Шалтгаан |
|---|---|
| `bad auth` | `<db_password>` орлуулагчийг бодит нууц үгээр солиогүй |
| `bad auth` | Нууц үгэнд `@ : / ? #` зэрэг тэмдэгт байгаад URL-encode хийгээгүй |
| `bad auth` | Нууц үг хуулахдаа хоосон зай / мөр таслалт орсон |
| `bad auth` | Хэрэглэгчийн эрх «Read and write to any database» биш |
| Timeout | Network Access дээр `0.0.0.0/0` нэмээгүй |

Скрипт нь нууц үгийг хэвлэхгүй, encode-ийн алдаа байвал зассан хувилбарыг санал болгоно.

### Анхаарах зүйлс

- **Үнэгүй багц 15 минут ажиллагаагүй бол унтардаг.** Дараагийн хүсэлт ~50 секунд
  хүлээнэ. Бодит хэрэглэгчидтэй бол Starter багц руу шилжих, эсвэл гаднаас
  `/api/health` рүү тогтмол ping хийх хэрэгтэй.
- **Файлын систем түр зуурынх.** Бүх өгөгдөл Mongo-д байдаг тул асуудалгүй. Гэхдээ
  `BANK_QR_FILE` нь repo дотор байх ёстой (`backend/data/` дотор commit хийнэ).
- **Google OAuth** дээр production домэйнээ redirect URI болгон нэмэхээ мартуузай.
- `requirements.txt` нь зөвхөн ажиллахад хэрэгтэй **9 багц**. Тест, скрипт, linter
  нь `requirements-dev.txt` дотор — build хурдан байхын тулд салгасан.

---

## Deploy — өөр газар

Backend бол ердийн FastAPI апп тул Docker ажиллуулдаг ямар ч газар (Railway,
Fly.io, өөрийн VPS) байрлана. Шаардлага нь ижил: MongoDB холболт, `backend/.env.example`-ийн
дагуух орчны хувьсагчид, гаднаас хандах `PUBLIC_URL`, мөн

```bash
uvicorn server:app --host 0.0.0.0 --port $PORT
```
