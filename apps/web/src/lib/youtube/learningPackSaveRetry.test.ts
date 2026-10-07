import { describe, expect, it } from "vitest";
import { shouldRetryLearningPackSaveWithoutExtras } from "./learningPackSaveRetry";

describe("shouldRetryLearningPackSaveWithoutExtras", () => {
  it("retries on ArgumentValidationError for unknown optional fields", () => {
    expect(
      shouldRetryLearningPackSaveWithoutExtras(
        'ArgumentValidationError: Object contains extra field `contentType` that is not in the validator.',
      ),
    ).toBe(true);
    expect(
      shouldRetryLearningPackSaveWithoutExtras(
        "ArgumentValidationError: Object contains extra field `graphPayload`",
      ),
    ).toBe(true);
  });

  it("retries on schema / size failures that extras can cause", () => {
    expect(
      shouldRetryLearningPackSaveWithoutExtras(
        "DocumentDoesNotMatchSchema: Field `graphPayload` is not in the schema",
      ),
    ).toBe(true);
    expect(
      shouldRetryLearningPackSaveWithoutExtras("Value is too large"),
    ).toBe(true);
  });

  it("does not retry unrelated failures", () => {
    expect(shouldRetryLearningPackSaveWithoutExtras("googleSub required")).toBe(
      false,
    );
    expect(shouldRetryLearningPackSaveWithoutExtras("Network error")).toBe(
      false,
    );
    expect(shouldRetryLearningPackSaveWithoutExtras("")).toBe(false);
  });
});
