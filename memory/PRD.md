# PRD — ЗХД Шалгалт (Mongolian Traffic Rules Exam Prep)

## Original problem statement
Build a mobile-first app to prepare for Mongolia's driving-license traffic-rules exam. 800 questions from an Excel file, grouped into categories. Users practice by category then take a real exam. UI fully in Mongolian Cyrillic; clean, calm, modern. Google login + unique profile name. Free/PRO tiers. Telegram admin bot activates PRO. Light/dark mode. (User originally described Next.js/Vercel/Render + Express, but agreed to build on the Emergent stack: **Expo + FastAPI + MongoDB**, deployed via Emergent.)

## Architecture
- **Frontend:** Expo (React Native) + Expo Router, @tanstack/react-query, Manrope font (Cyrillic), light+dark theme tokens in `src/theme.ts`, Ionicons.
- **Backend:** FastAPI + MongoDB (motor). Static question images served at `/api/images/*`. Telegram bot via webhook + httpx.
- **Auth:** Emergent-managed Google Sign-In (session_token, 7-day). `src/lib/auth.tsx` gate.
- **Data:** `scripts/seed.py` reads `data/ZHD_800.xlsx`, validates, extracts 226 images, seeds `categories` (33) + `questions` (800). `skipped_rows.json` = [] (0 broken).

## MongoDB collections
users, user_sessions, categories, questions, attempts, userProgress, dailyUsage.

## User personas
- **Шинэ жолооч (Free):** revising for the first time; limited to 2 categories, 30 q/day, 1 exam/day.
- **Идэвхтэй суралцагч (PRO):** unlimited practice/exams, wrong-answer drill, detailed stats.
- **Админ:** activates PRO via Telegram bot using the user's profile name.

## Core requirements (static)
- Verbatim Excel question/answer text (no editing).
- Practice: instant color+icon feedback, explanation, question-grid jump, bookmark.
- Exam: random 20, 25-min timer, no live feedback, auto-grade, pass ≥75%, wrong list + review.
- Free/PRO gating (categories, daily questions, daily exams, wrong-mode, detailed stats).
- Telegram admin-only bot (/pro, /unpro, /check, /list, plain name), case-insensitive.
- PRO status auto-refresh via polling.

## Implemented (2026-06)
- ✅ Excel seed + validation (800 q / 33 cat / 226 images / 0 errors, MongoDB count matches).
- ✅ Google auth + first-time profile-name setup with real-time uniqueness check.
- ✅ 5-tab bottom nav: Нүүр / Бүлэг / Шалгалт / Статистик / Профайл.
- ✅ Home dashboard, Categories (locked cards), Practice mode, Exam mode + Results, Wrong/Bookmark review, Statistics, Profile (copy name, edit, theme toggle, logout, PRO modal).
- ✅ Free/PRO gating end-to-end; daily usage tracking.
- ✅ Telegram admin bot (webhook set, secret-verified, admin-only) — activate/deactivate/check/list.
- ✅ Light + dark mode.
- ✅ Backend fully tested (33/33 passing); frontend login verified.

### Update 2026-06 (feature)
- ✅ **Бүлгээр шалгалт (category-specific exam)**: `/api/exam/start?category_id=` draws random 20 (or fewer for small categories) from one category, applies the same Free/PRO category lock and daily-exam limit; answers not exposed. Exam tab has a category picker sheet; category name shown in exam header and on the result screen; attempts store category_name. Verified via curl (PRO cat_5 → 20 q, FREE locked cat_10 → 403, small cat → all q).

### Update 2026-09 (polish + features + APK)
- ✅ **Data pipeline rebuilt from `ZHD_800_asuult_zuragtai.xlsx`**: anchor-mapped image extraction (226 imgs verified against numbering), exported to committed `backend/data/questions.json` + `categories.json` (800 q / 33 cat / 0 broken; counts match the workbook's Хураангуй sheet). Backend **auto-seeds an empty DB on startup** from JSON (no Excel/openpyxl at runtime); `scripts/seed_from_json.py` for manual reseed.
- ✅ **P1 done:** daily-limit reset localized to Mongolia time (UTC+8).
- ✅ **Study streak + total study days** (`/stats`), shown on Home hero + Stats card.
- ✅ **Daily goal** card on Home (tap to cycle 10/20/30/50; progress from today's answers; on-device).
- ✅ **Category search** on the Бүлэг tab.
- ✅ **Resume practice** — restores last-viewed question per category (on-device); auto scroll-to-top on question change (practice + exam).
- ✅ **Past-exam detail** — `GET /attempts/{id}` + `app/attempt/[id]`, tappable from Home/Stats; shared `AttemptReview` with All / Wrong-only filter (result screen reuses it).
- ✅ **Share result** (native Share sheet).
- ✅ **Polish:** answer-reveal success/error haptics, card elevation, safe-area-aware tab bar, query cache defaults (offline-tolerant), Android app label → «ЗХД Шалгалт».
- ✅ **Android build ready:** `expo prebuild` android/ generated, release signed with debug key (installable), `eas.json` preview(APK)/production(AAB) profiles. Build must run in a normal terminal — this dev environment blocks JVM AF_UNIX loopback so local Gradle can't run here (user's terminal / EAS cloud is unaffected).

## Backlog / remaining
- **P2:** Per-category exam mode already shipped (2026-06); consider streak reminders / push.
- **P2:** Production upload keystore + Play Store listing; localize daily-goal reset note.
- **Deploy step:** set `EXPO_PUBLIC_BACKEND_URL` to the published backend, then build APK (README §"Android APK бэлдэх").

## Next tasks
- Gather user feedback on preview; adjust pass threshold / limits if requested.
- On deploy: run `/api/telegram/set-webhook` against production URL; set real TELEGRAM_* secrets in Deployment → Secrets.
