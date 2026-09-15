/**
 * Shape of the question bank, for copy that is shown before the API is reached
 * (the sign-in screen, upsell sheets). Screens that already have the data —
 * the category list, stats — should use what the API returned instead.
 *
 * Keep in step with `backend/data/categories.json`; `scripts/import_xlsx.py`
 * prints both numbers when the workbook is re-imported.
 */
export const TOTAL_QUESTIONS = 800;
export const TOTAL_CATEGORIES = 36;
