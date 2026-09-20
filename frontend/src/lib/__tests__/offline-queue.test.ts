import AsyncStorage from "@react-native-async-storage/async-storage";

import { ApiError } from "@/src/lib/api";
import {
  clearAnswerQueue,
  enqueueAnswer,
  flushAnswers,
  pendingAnswerCount,
} from "@/src/lib/offline-queue";

jest.mock("@/src/lib/api", () => {
  class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    ApiError,
    api: { post: jest.fn(), get: jest.fn() },
  };
});

const { api } = jest.requireMock("@/src/lib/api") as { api: { post: jest.Mock } };

beforeEach(async () => {
  await AsyncStorage.clear();
  await clearAnswerQueue();
  api.post.mockReset();
});

describe("offline answer queue", () => {
  it("keeps one entry per question — the latest answer wins", async () => {
    await enqueueAnswer("q1", "А");
    await enqueueAnswer("q2", "Б");
    await enqueueAnswer("q1", "В");

    expect(await pendingAnswerCount()).toBe(2);

    api.post.mockResolvedValue({ isCorrect: true });
    await flushAnswers();

    const sent = api.post.mock.calls.map((c) => c[1]);
    expect(sent).toEqual([
      { question_id: "q2", selectedKey: "Б" },
      { question_id: "q1", selectedKey: "В" },
    ]);
  });

  it("uploads everything it can and empties the queue", async () => {
    await enqueueAnswer("q1", "А");
    await enqueueAnswer("q2", "Б");
    api.post.mockResolvedValue({});

    expect(await flushAnswers()).toBe(2);
    expect(await pendingAnswerCount()).toBe(0);
  });

  it("stops at the first connection failure and keeps the rest queued", async () => {
    await enqueueAnswer("q1", "А");
    await enqueueAnswer("q2", "Б");
    await enqueueAnswer("q3", "В");

    api.post
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new ApiError(0, "offline"));

    expect(await flushAnswers()).toBe(1);
    // q2 and q3 survive for the next attempt.
    expect(await pendingAnswerCount()).toBe(2);
  });

  it("drops answers the server refuses, so they cannot loop forever", async () => {
    await enqueueAnswer("q1", "А");
    await enqueueAnswer("q2", "Б");

    api.post
      .mockRejectedValueOnce(new ApiError(429, "quota"))
      .mockResolvedValueOnce({});

    expect(await flushAnswers()).toBe(1);
    expect(await pendingAnswerCount()).toBe(0);
  });

  it("retries later when the server is down (5xx)", async () => {
    await enqueueAnswer("q1", "А");
    api.post.mockRejectedValueOnce(new ApiError(503, "down"));

    expect(await flushAnswers()).toBe(0);
    expect(await pendingAnswerCount()).toBe(1);
  });
});
