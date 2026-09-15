# Ажлын явц

> Сесс тасарвал дараагийн удаа **«PROGRESS.md-г үргэлжлүүл»** гэж бичихэд эндээс үргэлжилнэ.

## Дууссан

- [x] **QPay төлбөр** — `backend/qpay_client.py` (async QPay v2 client), `/api/payments/*`,
      `QPayModal.tsx`. Callback + polling хоёулаа QPay-ээс дахин баталгаажуулдаг.
- [x] **Дансаар шилжүүлэх** (мерчант гэрээгүй) — `/api/payments/bank/*`,
      `BankTransferModal.tsx`, Telegram inline товч (`payok:` / `payno:`), `/pending` команд.
- [x] `find_one_and_update(projection=…, return_document=…)` → `update_one` + `modified_count`
      (чимээгүй алдах эрсдэлийг арилгасан).

## Хийгдэж буй аудитаас гарсан ажлууд

### Backend

- [x] **B1. Free хэрэглэгчийн шалгалтын хязгаар алдаатай** — `examsTaken` нь `exam/submit` дээр
      нэмэгддэг тул шалгалт эхлүүлээд илгээхгүй орхивол хязгаар хэзээ ч дүүрэхгүй.
      `exam/start` дээр тоолох болгох.
- [x] **B2. `questions` цуглуулга индексгүй** — `question_id`, `category_id` дээр индекс алга.
      Асуулт хариулах бүрт бүтэн collection scan.
- [x] **B3. `exam/start` бүх 800 id-г санах ойд ачаалж байна** — `$sample` aggregation болгох.
- [x] **B4. `exam/submit` 20 удаа дараалан DB дуудаж байна** — `bulk_write` болгох.
- [x] **B5. `GET /categories` бүх асуулт + бүх progress-ийг ачаалж байна** — aggregation болгох.
- [x] **B6. CORS `allow_origins=["*"]` + `allow_credentials=True`** — стандартаар зөрчилтэй хослол.
- [x] **B7. `auth_me`-д ашиглагдахгүй `user=None` параметр** — OpenAPI дээр query param болж харагдана.
- [x] **B8. Хуучирсан `NEW` нэхэмжлэх, дууссан сесс хуримтлагдана** — цэвэрлэгээ нэмэх.

### Frontend

- [x] **F1. Free хэрэглэгчид өдрийн үлдэгдэл харагдахгүй** — давтах дэлгэц дээр `12/30` заах.
- [x] **F2. Нэр хадгалах алдаа чимээгүй залгигдана** (`catch { /* ignore */ }`).
- [x] **F3. Профайл дээр PRO төлөв / төлбөрийн түүх байхгүй.**
- [x] **F4. PRO хэрэглэгч дээр ч `/auth/me` 15 секунд тутам дуудагдана.**

## Замдаа нэмж засагдсан

- `practice/answer` хязгаар нь тоолуурын утгатай зөрчилдөж, өмнө үзсэн асуултаа
  давтахыг хүртэл хаадаг байсан → зөвхөн шинэ асуулт хаагдана.
- Профайл нэр шалгах debounce нь race-тэй байсан (удаан ирсэн хуучин хариу шинийг
  дарж бичдэг) → `src/lib/use-name-check.ts` hook болж, react-query дээр суурилсан.
  Хоёр дэлгэцийн давхардсан код нэг болов.
- `theme.ts` дэх 3 TypeScript алдаа (`ColorSchemeName` нь `null` биш `"unspecified"`).
- Lint: `Date.now()`-г render дотор дуудаж байсан, ашиглагдахгүй import-ууд,
  effect дотор setState хийж байсан газрууд (модалуудыг react-query рүү шилжүүлсэн).

**Одоогийн байдал:** frontend `tsc` 0 алдаа, `eslint` 0 асуудал. Offline тест 4 багц бүгд PASS.

## Тест

`backend/tests/offline/` — MongoDB, интернэт, QPay аль нь ч хэрэггүй:

```bash
pip install mongomock-motor
python backend/tests/offline/run_all.py
```

| Багц | Шалгалт |
|---|---|
| `test_qpay_client.py` | QPay client (stub сервер) |
| `test_qpay_flow.py` | 19 |
| `test_bank_flow.py` | 30 |
| `test_core_flow.py` | 37 |
| `test_exam_session.py` | 40 |
| `test_admin_bot.py` | 24 |
| `test_google_auth.py` | 27 |

## Хоёрдугаар үе шат (дууссан)

- [x] **Шалгалтын сесс сервер талд** — `examSessions`, autosave, үргэлжлүүлэх,
      хугацаа дуусахад автомат дүгнэлт, цуцлах. Энэ нь B1 засвар (эхлэхэд тоолох)
      үүсгэсэн эрсдэлийг — апп унавал өдрийн эрх дэмий алдагдах — хаасан.
      Аппд «Дуусаагүй шалгалт байна» карт, «Үргэлжлүүлсэн» тэмдэг нэмэгдсэн.
- [x] **Зургийн prefetch** — `src/lib/prefetch.ts`, дараагийн 3 асуултын зургийг
      урьдчилж татна (давтах болон шалгалтын дэлгэц хоёуланд нь).
- [x] **Telegram `/stats`** — хэрэглэгч, өнөөдрийн шинэ/идэвхтэй, шалгалт, орлого.
- [x] **`test_backend.py` зам** — `BACKEND_URL` эсвэл `frontend/.env`, аль нь ч
      байхгүй бол алдаа өгөхгүй алгасна.
- [x] **Үр дүнгийн дэлгэц** — санах ойн хувьсагчаас л уншдаг байсныг `attemptId`
      параметрээр сэргээдэг болгов (апп restart хийвэл хоосон болохоо больсон).

## Гуравдугаар үе шат (дууссан)

**Emergent-ээс бүрэн салсан.** Гуравдагч платформын ул мөр үлдээгүй:

- [x] `POST /auth/session` (Emergent-ийн session-data) → **`POST /auth/google`**.
      `backend/google_auth.py` нь Google-ийн JWKS-ээр ID token-ыг шалгаж,
      backend өөрөө `secrets.token_urlsafe(32)` сесс токен гаргана. Client secret
      хэрэггүй, зөвхөн client ID. Хэрэглэгчийг Google `sub`-аар таньдаг тул
      и-мэйл солигдоход данс андуурагдахгүй.
- [x] `frontend/src/lib/auth.tsx` бүхэлдээ дахин бичигдсэн — `expo-auth-session`
      дээр суурилсан. `auth.emergentagent.com` руу үсрэхээ больсон.
- [x] `.emergent/` фолдер, `emergentintegrations` dependency устгагдсан.
- [x] `.gitconfig` дахь `emergent-agent-e1` → өөрийн нэр/и-мэйл.
- [x] Bundle ID `com.emergent.licenseexamapp.b72zgh` → **`mn.zhdshalgalt.app`**,
      scheme `frontend` → `zhdshalgalt`, slug → `zhd-shalgalt`.
- [x] README-гийн Emergent Deploy бүлэг → платформоос хамааралгүй заавар +
      «Google Sign-In тохируулах» шинэ бүлэг.

**Локал орчин асаалттай болсон:**

- [x] MongoDB 8.3.7 суулгаж, Windows үйлчилгээ болгон ажиллуулсан.
- [x] `backend/.env`, `frontend/.env` үүсгэсэн. Backend `http://localhost:8000`
      дээр, апп `http://localhost:8081` дээр ажиллаж байгааг баталгаажуулсан.

**Seed өгөгдлийн ноцтой алдаа илэрч зассан:**

- [x] `categories.json` дахь 33 бүлгийн `category_id` зөвхөн **25 өвөрмөц** байсан.
      Дүрмийн 1-8 бүлэг, замын тэмдгийн 1-8 бүлэг хоёр ижил `cat_1..cat_8` ашиглаж
      байсан тул хоёр өөр бүлгийн асуулт нэг ангилалд холилдож байв (`cat_1` дотор
      93 асуулт, хоёр өөр бүлгийн нэртэйгээр). Одоо `cat_01..cat_33` болж,
      `questions.json` ч хамт дахин холбогдсон — 33 бүлэг, 800 асуулт, тоо бүрэн таарсан.
      *Энэ алдааг миний нэмсэн unique индекс илрүүлсэн; өмнө нь чимээгүй өнгөрдөг байсан.*

## Render deploy бэлтгэл (дууссан)

- [x] `requirements.txt` → ажиллахад хэрэгтэй **9 багц** (өмнө 28 байсан; pandas,
      numpy, jq, boto3, pytest, linter бүгд орсон байв). Цэвэр venv дээр суулгаж
      backend бүрэн импортлогдож байгааг баталгаажуулсан.
- [x] `requirements-dev.txt` — тест, Excel скрипт, linter.
- [x] `render.yaml` blueprint — Python 3.12, `rootDir: backend`, health check
      `/api/health`, орчны хувьсагчид бүгд бичигдсэн.
- [x] `.gitignore` алдаа: `.env.*` дүрэм нь `!.env.example`-ийн дараа ирдэг байсан
      тул **`.env.example` файлууд орхигдож** байв — clone хийсэн хүн тохиргооны
      жишээг олохгүй. Негацийг доод талд зөөж зассан.
- [x] README-д «Deploy — Render + MongoDB Atlas» бүлэг (Atlas үүсгэх, GitHub руу
      түлхэх, Blueprint-ээр үүсгэх, free багцын унтардаг зан төлөв).

## Дараа нь хийж болох

- [ ] **Google Cloud Console дээр OAuth client үүсгэж client ID-нуудаа `.env`-д тавих**
      (үүнгүйгээр нэвтрэх товч идэвхгүй хэвээр)
- [ ] Туршилтын `demo@local.test` хэрэглэгчийг DB-ээс устгах
- [ ] Асуултын зураг offline кэшлэх (бүлэг бүрийн зургийг урьдчилж татах сонголт)
- [ ] `q_public` дотор бүлгийн нэрийг давхар хадгалахын оронд lookup хийх
- [ ] Хэрэглэгч устгах / өгөгдлөө татах (GDPR маягийн) endpoint