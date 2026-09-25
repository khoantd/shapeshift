import { choice, noul, score } from "@typesafe-ai/sdk";

/**
 * The full Jev question schema. Jev evaluates every question in parallel against
 * the same state, so we ask every signal every time (speculative fan-out) and let
 * code decide which ones matter for the chosen intent.
 *
 * Criteria rules: self-contained, non-overlapping, every signal has an escape option,
 * and never ask Jev to extract values, count or do date math.
 */
export const questions = {
  // ── Which UI ────────────────────────────────────────────────
  intent: choice("What is the person trying to create with this text", {
    event: "Scheduling a meeting, meal, call or gathering at a time, usually with other people",
    reminder: "Asking to be reminded to do a single task themselves, e.g. 'remind me to…'",
    todo: "Listing several separate things to do or buy",
    timer: "Starting a timer, countdown, focus session or stopwatch for a duration",
    habit: "Something they want to do repeatedly as a routine, e.g. daily or weekly",
    color: "Referring to a color: a hex code, rgb value, or a described color",
    split: "Dividing an amount of money between several people",
    tip: "Calculating a tip or gratuity on a restaurant or service bill, optionally split among people",
    expense: "Recording money they spent on something",
    convert: "Converting a value from one unit of measurement to another",
    calc: "A math calculation or percentage that is not splitting money, tipping a bill, or converting units",
    travel: "Planning a trip, flight, train or stay to a destination",
    poll: "Asking a group to choose between options",
    contact: "Saving a person's name with a phone number or email address",
    link: "Saving a web link or URL, optionally with a note",
    countdown: "Counting the days until a future date, holiday or event",
    timezone: "Converting a time of day between time zones or cities, or asking the time somewhere",
    random: "Asking for a random result: rolling dice, flipping a coin, a random number or letting chance pick",
    goal: "Tracking progress toward a numeric target, such as 4 of 12 books read or money saved",
    rtcfc: "Building an RTCFC or RTF-style AI prompt with Role, Task, Context, Format, and Constraints sections",
    bcmt: "Building a BCMT-style AI prompt with Bối cảnh, Con người, Mục tiêu, and Tiêu chuẩn sections (optional Đầu vào)",
    triage: "Prioritizing a support ticket, incident or customer report with a suggested priority level",
    classify: "Categorizing a document or piece of text into a known category",
    moderate: "Reviewing content against a policy to decide whether a moderator should flag it",
    eval: "Evaluating a generated answer against a user request and reference material",
    route: "Routing a form or request by assigning an owner or asking for another review",
    approve: "Reviewing a proposed tool call to allow execution or pause for approval",
    workout: "Logging a single strength exercise with sets, reps and optional weight, e.g. '3x10 bench press 60kg'",
    emi: "Calculating a loan EMI or monthly installment from principal, interest rate and tenure",
    recipe: "Capturing a recipe with a dish name, ingredients list and optional servings",
    note: "Writing a thought, idea or note that is none of the above",
    none: "Too short, unclear or unfinished to tell yet",
  }),

  readiness: score("How complete is this input for what the person is creating", [
    "Just started, key details missing",
    "Partially specified, some details present",
    "Fully specified, ready to act on",
  ]),

  // ── Signals that pick the UI variant ────────────────────────
  isQuestion: noul("The text is a question rather than an instruction or statement"),
  recurring: noul("The text describes something that repeats on a schedule"),
  urgency: score("How urgent or time-sensitive the text sounds", [
    "Not urgent at all",
    "Somewhat time-sensitive",
    "Urgent, needs attention immediately",
  ]),
  tone: choice("The emotional tone of the text", {
    neutral: "Plain and factual, no clear emotion",
    positive: "Happy, grateful or content",
    excited: "Enthusiastic or looking forward to something",
    stressed: "Worried, frustrated or under pressure",
    reflective: "Thoughtful, calm or introspective",
  }),
  eventMode: choice("How the gathering or meeting would take place", {
    in_person: "Meeting physically at a place",
    video_call: "A video call such as Zoom, Meet or FaceTime",
    phone_call: "A phone call",
    unspecified: "Not mentioned or not a meeting",
  }),
  transport: choice("How the person would travel", {
    flight: "By plane",
    train: "By train",
    bus: "By bus",
    car: "By car or road trip",
    unspecified: "Not mentioned or not about travel",
  }),
  tripType: choice("The purpose of the trip", {
    work: "Work or business travel",
    leisure: "Holiday, vacation or personal visit",
    unspecified: "Not mentioned or not about travel",
  }),
  expenseCategory: choice("What the money was spent on", {
    food: "Food, groceries, restaurants or drinks",
    transport: "Cabs, fuel, tickets or commuting",
    shopping: "Clothes, gadgets or other purchases",
    bills: "Rent, utilities, subscriptions or recharges",
    entertainment: "Movies, events, games or outings",
    health: "Medicine, doctor or fitness",
    other: "Something else or not about spending",
  }),
  colorMood: choice("The feel of the color described", {
    warm: "Reds, oranges, yellows",
    cool: "Blues, greens, purples",
    neutral: "Greys, beiges, off-whites",
    vivid: "Very bright and saturated",
    pastel: "Soft and light",
    dark: "Deep and dark",
  }),
  timerKind: choice("What kind of timer is wanted", {
    countdown: "A plain countdown for a duration",
    focus: "A focus or deep-work session",
    break: "A rest or break",
    stopwatch: "Counting up with no end time",
  }),
  hasExplicitOptions: noul("The text names two or more explicit options to pick between"),
  isShoppingList: noul("The listed items are things to buy"),

  // ── Decision / review cards ─────────────────────────────────
  ticketPriority: score("Suggested priority for this support ticket or customer report", [
    "Low — can wait in the normal queue",
    "Medium — should be handled soon",
    "High — needs prompt attention",
    "Critical — needs immediate attention",
  ]),
  docCategory: choice("Which category best fits this document or text", {
    finance: "Invoices, budgets, payments or financial reports",
    legal: "Contracts, terms, compliance or legal notices",
    hr: "Resumes, hiring, payroll or people operations",
    product: "Specs, roadmaps, feature notes or product docs",
    support: "Customer tickets, help articles or troubleshooting",
    marketing: "Campaigns, copy, ads or go-to-market material",
    other: "Something else or not about categorizing a document",
  }),
  needsModeration: noul("The content likely violates policy and should be flagged for a moderator"),
  answerQuality: score("How well the generated answer matches the request and reference material", [
    "Poor — incomplete, wrong or unsupported",
    "Acceptable — mostly fine with minor gaps",
    "Good — accurate, complete and well grounded",
  ]),
  needsRevision: noul("The generated answer should be revised before it is accepted"),
  routeDecision: choice("How this form or request should be routed", {
    assign: "Assign an owner or queue and move it forward",
    another_review: "Request another review before assigning",
    unspecified: "Not about routing a form or request",
  }),
  toolApproval: choice("Whether the proposed tool call should run", {
    allow: "Allow execution of the tool call",
    pause: "Pause and wait for human approval",
    unspecified: "Not about reviewing a tool call",
  }),
};

export const QUESTION_COUNT = Object.keys(questions).length;
