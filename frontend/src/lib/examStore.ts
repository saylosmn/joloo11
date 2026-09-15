// Ephemeral holder to pass the finished exam attempt to the result screen.
export type ExamResult = {
  attempt_id: string;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  durationSeconds?: number;
  category_name?: string | null;
  detail: {
    question_id: string;
    questionText: string;
    imageUrl?: string | null;
    options: { key: string; text: string }[];
    selectedKey?: string | null;
    correctKey: string;
    explanation?: string;
    isCorrect: boolean;
  }[];
};

let lastResult: ExamResult | null = null;

export function setExamResult(r: ExamResult) {
  lastResult = r;
}
export function getExamResult(): ExamResult | null {
  return lastResult;
}
