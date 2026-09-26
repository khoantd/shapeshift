import { describe, expect, test } from "bun:test";
import { mockClassify, MOCK_QUESTION_COUNT } from "../jev/mock";
import { QUESTION_COUNT } from "../jev/questions";
import { rawState } from "../decide";
import { intentResultSchema } from "../jev/types";

const EXAMPLES: [string, string][] = [
  ["dinner with priya friday 8pm", "event"],
  ["remind me to call mom tomorrow", "reminder"],
  ["buy milk, eggs, bread and coffee", "todo"],
  ["25 min focus", "timer"],
  ["timer 10 minutes", "timer"],
  ["meditate every morning", "habit"],
  ["gym 3x a week", "habit"],
  ["#ff6b35", "color"],
  ["a warm sunset orange", "color"],
  ["minecraft diamond", "color"],
  ["tiffany blue", "color"],
  ["discord blurple", "color"],
  ["the color of the ocean", "color"],
  ["split 2400 between 3", "split"],
  ["tip 18% on 2400 for 4", "tip"],
  ["18% tip on $90", "tip"],
  ["spent 450 on uber", "expense"],
  ["5 miles in km", "convert"],
  ["72f to c", "convert"],
  ["18% of 3450", "calc"],
  ["(120+80)*3", "calc"],
  ["flight to goa next weekend", "travel"],
  ["pizza or burgers for friday?", "poll"],
  ["rahul 98200 12345 rahul@mail.com", "contact"],
  ["https://vercel.com/blog check later", "link"],
  ["i keep thinking about how quiet the city felt this morning", "note"],
  ["days until christmas", "countdown"],
  ["how many days till my birthday on dec 12", "countdown"],
  ["3pm pst in ist", "timezone"],
  ["what time is it in tokyo", "timezone"],
  ["roll 2d6", "random"],
  ["flip a coin", "random"],
  ["random number 1-100", "random"],
  ["read 12 books this year, 4 done", "goal"],
  ["4 of 10 workouts", "goal"],
  ["rtcfc", "rtcfc"],
  ["Role: staff engineer. Task: review this PR. Context: NestJS. Format: severity table. Constraints: skip style nits", "rtcfc"],
  ["bcmt", "bcmt"],
  [
    "Bối cảnh: CRM SME Việt. Con người: CSM 5 năm; chủ SME bận. Mục tiêu: email kích hoạt trial. Tiêu chuẩn: ≤120 từ, tiếng Việt",
    "bcmt",
  ],
  ["Title: Payment failed. Report: Customer charged twice. Service: Billing. Triage this ticket", "triage"],
  ["Classify this document. Q3 invoice for Acme totaling 12400. Categories: finance, legal, hr, product", "classify"],
  ["Content: You should be fired idiot. Policy: No personal attacks. Flag for moderator", "moderate"],
  ["Request: What is our refund window? Answer: 14 days from purchase. Reference: Help center. Evaluate this answer", "eval"],
  ["Subject: New vendor signup. Fields: company, tax id. Owners: Maya, Billing queue. Route this form", "route"],
  ['Tool: send_email. Args: {"to":"user@acme.com","subject":"Welcome"}. Pause for approval', "approve"],
  ["3x10 bench press 60kg", "workout"],
  ["squats 5 sets of 5 at 100kg", "workout"],
  ["emi on 5 lakh at 9% for 5 years", "emi"],
  ["loan 500000 at 8.5% for 36 months", "emi"],
  ["pasta with garlic, tomato and olive oil for 2", "recipe"],
  ["recipe: chocolate chip cookies. ingredients: flour, butter, sugar, eggs", "recipe"],
  ["critical news on AI regulation", "news"],
  ["news about climate from Reuters", "news"],
  ["headlines on semiconductor supply", "news"],
];
describe("mock classifier", () => {
  test("question count matches schema", () => expect(MOCK_QUESTION_COUNT).toBe(QUESTION_COUNT));
  for (const [text, intent] of EXAMPLES) {
    test(`${text} → ${intent} (committed)`, () => {
      const r = mockClassify(text);
      expect(intentResultSchema.parse(r)).toBeTruthy();
      expect(r.intent.value).toBe(intent as never);
      expect(rawState(r)).toEqual({ kind: "committed", intent } as never);
    });
  }
  test("short text → none", () => expect(mockClassify("a").intent.value).toBe("none"));
  test("on zoom → video_call", () => expect(mockClassify("dinner with priya friday 8pm on zoom").signals.eventMode.value).toBe("video_call"));
  test("urgent → high urgency", () => expect(mockClassify("remind me to pay rent tomorrow urgent").signals.urgency.score).toBeGreaterThan(1.2));
});
