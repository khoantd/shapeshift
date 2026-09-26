import { describe, expect, test } from "bun:test";
import { parseEvent } from "../parse/event";
import { parseReminder } from "../parse/reminder";
import { parseTodo } from "../parse/todo";
import { parseTimer, formatClock } from "../parse/timer";
import { parseHabit } from "../parse/habit";
import { parseColor } from "../parse/color";
import { parseSplit } from "../parse/split";
import { parseTip } from "../parse/tip";
import { parseExpense } from "../parse/expense";
import { parseConvert } from "../parse/convert";
import { evaluate, parseCalc } from "../parse/calc";
import { parseTravel } from "../parse/travel";
import { parsePoll } from "../parse/poll";
import { parseContact } from "../parse/contact";
import { parseLink } from "../parse/link";
import { parseNote } from "../parse/note";
import { shades, hexToOklch, oklchToHex } from "../color";

// Tuesday 22 Sep 2026, 10:00 local
const REF = new Date(2026, 8, 22, 10, 0);

describe("event", () => {
  test("dinner with priya friday 8pm", () => {
    const e = parseEvent("dinner with priya friday 8pm", REF);
    expect(e.title).toBe("Dinner");
    expect(e.people).toEqual(["Priya"]);
    expect(e.date?.getDay()).toBe(5);
    expect(e.date?.getHours()).toBe(20);
    expect(e.hasTime).toBe(true);
  });
  test("on zoom → link", () => {
    const e = parseEvent("dinner with priya friday 8pm on zoom", REF);
    expect(e.link).toBe("Zoom");
    expect(e.people).toEqual(["Priya"]);
    expect(e.title).toBe("Dinner");
  });
  test("multiple people", () => {
    expect(parseEvent("lunch with rahul and anna tomorrow", REF).people).toEqual(["Rahul", "Anna"]);
  });
  test("partial: no date", () => {
    const e = parseEvent("coffee with sam", REF);
    expect(e.date).toBeNull();
    expect(e.title).toBe("Coffee");
  });
  test("location", () => {
    const e = parseEvent("team sync at blue tokai monday 10am", REF);
    expect(e.location).toBe("Blue Tokai");
    expect(e.title).toBe("Team sync");
  });
  test("empty", () => {
    expect(parseEvent("", REF).title).toBe("");
  });
});

describe("reminder", () => {
  test("remind me to call mom tomorrow", () => {
    const r = parseReminder("remind me to call mom tomorrow", REF);
    expect(r.task).toBe("Call mom");
    expect(r.when?.getDate()).toBe(23);
    expect(r.hasTime).toBe(false);
  });
  test("urgent word stripped", () => {
    expect(parseReminder("remind me to pay rent tomorrow urgent", REF).task).toBe("Pay rent");
  });
  test("with time", () => {
    const r = parseReminder("remind me to stretch at 4pm", REF);
    expect(r.hasTime).toBe(true);
    expect(r.task).toBe("Stretch");
  });
  test("no time", () => {
    expect(parseReminder("remind me to water plants", REF).when).toBeNull();
  });
  test("don't forget", () => {
    expect(parseReminder("don't forget to email ravi", REF).task).toBe("Email ravi");
  });
});

describe("todo", () => {
  test("buy milk, eggs, bread and coffee", () => {
    const t = parseTodo("buy milk, eggs, bread and coffee");
    expect(t.items).toEqual(["Milk", "Eggs", "Bread", "Coffee"]);
    expect(t.verb).toBe("buy");
  });
  test("newlines", () => expect(parseTodo("wash car\nfile taxes").items).toEqual(["Wash car", "File taxes"]));
  test("ampersand", () => expect(parseTodo("pens & paper").items).toEqual(["Pens", "Paper"]));
  test("drops empties", () => expect(parseTodo("a,, b ,").items).toEqual(["A", "B"]));
  test("prefix", () => expect(parseTodo("todo: laundry; dishes").items).toEqual(["Laundry", "Dishes"]));
});

describe("timer", () => {
  test("25 min focus", () => expect(parseTimer("25 min focus")).toEqual({ seconds: 1500, label: "Focus" }));
  test("timer 10 minutes", () => expect(parseTimer("timer 10 minutes").seconds).toBe(600));
  test("1h 30m", () => expect(parseTimer("1h 30m").seconds).toBe(5400));
  test("pomodoro", () => expect(parseTimer("pomodoro").seconds).toBe(1500));
  test("no duration", () => expect(parseTimer("stopwatch").seconds).toBeNull());
  test("seconds", () => expect(parseTimer("45 sec plank").seconds).toBe(45));
  test("clock", () => {
    expect(formatClock(1500)).toBe("25:00");
    expect(formatClock(5400)).toBe("1:30:00");
  });
});

describe("habit", () => {
  test("meditate every morning", () => {
    const h = parseHabit("meditate every morning");
    expect(h.title).toBe("Meditate");
    expect(h.days).toHaveLength(7);
    expect(h.label).toBe("Every morning");
  });
  test("gym 3x a week", () => {
    const h = parseHabit("gym 3x a week");
    expect(h.title).toBe("Gym");
    expect(h.perWeek).toBe(3);
    expect(h.days).toEqual([1, 3, 5]);
  });
  test("weekday names", () => expect(parseHabit("run on monday and thursday").days).toEqual([1, 4]));
  test("daily", () => expect(parseHabit("read daily").title).toBe("Read"));
  test("weekdays", () => expect(parseHabit("journal weekdays").days).toEqual([1, 2, 3, 4, 5]));
});

describe("color", () => {
  test("hex 6", () => expect(parseColor("#ff6b35").hex).toBe("#ff6b35"));
  test("hex 3", () => expect(parseColor("#f60").hex).toBe("#ff6600"));
  test("rgb", () => expect(parseColor("rgb(255, 107, 53)").hex).toBe("#ff6b35"));
  test("named, last word wins", () => {
    const c = parseColor("a warm sunset orange");
    expect(c.source).toBe("named");
    expect(c.name).toBe("orange");
  });
  test("minecraft diamond → reference color", () => {
    expect(parseColor("minecraft diamond")).toEqual({ hex: "#4aedd9", name: "minecraft diamond", source: "named" });
  });
  test("reference beats plain name", () => expect(parseColor("tiffany blue").hex).toBe("#0abab5"));
  test("hyphen and spacing variants", () => expect(parseColor("coca-cola red").hex).toBe("#f40009"));
  test("gem", () => expect(parseColor("ruby").name).toBe("ruby"));
  test("evocative word when nothing else", () => expect(parseColor("the color of the ocean").name).toBe("ocean"));
  test("plain name still beats evocative", () => expect(parseColor("a warm sunset orange").name).toBe("orange"));
    test("mood fallback", () => expect(parseColor("something cozy", "warm").source).toBe("mood"));
  test("nothing", () => expect(parseColor("hmm").hex).toBeNull());
  test("oklch round trip and 5 shades", () => {
    const o = hexToOklch("#3b5bdb")!;
    expect(oklchToHex(o)).toBe("#3b5bdb");
    expect(shades("#ff6b35")).toHaveLength(5);
  });
});

describe("split", () => {
  test("split 2400 between 3", () => expect(parseSplit("split 2400 between 3")).toEqual({ total: 2400, people: 3, currency: "₹" }));
  test("dollars", () => expect(parseSplit("split $90 among four").currency).toBe("$"));
  test("names", () => expect(parseSplit("split 900 between me, rahul and priya").people).toBe(3));
  test("ways", () => expect(parseSplit("1,200 4 ways").total).toBe(1200));
  test("partial", () => expect(parseSplit("split 500")).toEqual({ total: 500, people: null, currency: "₹" }));
});

describe("tip", () => {
  test("tip 18% on 2400 for 4", () =>
    expect(parseTip("tip 18% on 2400 for 4")).toEqual({ total: 2400, tipPercent: 18, people: 4, currency: "₹" }));
  test("18% tip on $90", () => expect(parseTip("18% tip on $90")).toEqual({ total: 90, tipPercent: 18, people: null, currency: "$" }));
  test("gratuity phrasing", () => expect(parseTip("gratuity 20 percent on 1500").tipPercent).toBe(20));
  test("partial: no percent", () => expect(parseTip("tip on 800")).toEqual({ total: 800, tipPercent: null, people: null, currency: "₹" }));
  test("partial: no total", () => expect(parseTip("tip 15%").total).toBeNull());
});

describe("expense", () => {
  test("spent 450 on uber", () => expect(parseExpense("spent 450 on uber")).toMatchObject({ amount: 450, item: "Uber" }));
  test("rs prefix", () => expect(parseExpense("paid rs. 1,299 for headphones").amount).toBe(1299));
  test("at", () => expect(parseExpense("120 at starbucks").item).toBe("Starbucks"));
  test("no amount", () => expect(parseExpense("spent on lunch").amount).toBeNull());
  test("k suffix", () => expect(parseExpense("spent 2k on groceries").amount).toBe(2000));
});

describe("convert", () => {
  test("5 miles in km", () => {
    const c = parseConvert("5 miles in km");
    expect(c.from).toBe("mi");
    expect(c.to).toBe("km");
    expect(c.result).toBeCloseTo(8.047, 2);
  });
  test("72f to c", () => expect(parseConvert("72f to c").result).toBeCloseTo(22.22, 1));
  test("kg to lbs", () => expect(parseConvert("10 kg to lbs").result).toBeCloseTo(22.05, 1));
  test("partial with default target", () => expect(parseConvert("100 km").to).toBe("mi"));
  test("degrees phrasing", () => expect(parseConvert("30 degrees c in f").result).toBeCloseTo(86, 1));
  test("nothing", () => expect(parseConvert("hello").value).toBeNull());
});

describe("calc", () => {
  test("18% of 3450", () => expect(parseCalc("18% of 3450").result).toBeCloseTo(621));
  test("(120+80)*3", () => expect(parseCalc("(120+80)*3").result).toBe(600));
  test("precedence", () => expect(evaluate("2+3*4^2")).toBe(50));
  test("right assoc power", () => expect(evaluate("2^3^2")).toBe(512));
  test("unary minus", () => expect(evaluate("-3+5")).toBe(2));
  test("x and ÷", () => expect(parseCalc("12 x 4 ÷ 2").result).toBe(24));
  test("invalid", () => expect(parseCalc("(1+").result).toBeNull());
  test("percent off", () => expect(parseCalc("20% off 1500").result).toBe(1200));
});

describe("travel", () => {
  test("flight to goa next weekend", () => {
    const t = parseTravel("flight to goa next weekend", REF);
    expect(t.destination).toBe("Goa");
    expect(t.start?.getDay()).toBe(6);
    expect(t.end?.getDay()).toBe(0);
  });
  test("range", () => {
    const t = parseTravel("trip to tokyo 12-15 oct", REF);
    expect(t.destination).toBe("Tokyo");
    expect(t.start?.getDate()).toBe(12);
    expect(t.end?.getDate()).toBe(15);
  });
  test("origin", () => {
    const t = parseTravel("train from mumbai to pune tomorrow", REF);
    expect(t.origin).toBe("Mumbai");
    expect(t.destination).toBe("Pune");
  });
  test("multi-word", () => expect(parseTravel("trip to new york", REF).destination).toBe("New York"));
  test("no destination", () => expect(parseTravel("flight", REF).destination).toBeNull());
});

describe("poll", () => {
  test("pizza or burgers for friday?", () => {
    const p = parsePoll("pizza or burgers for friday?");
    expect(p.options).toEqual(["Pizza", "Burgers"]);
    expect(p.title).toBe("Pizza or burgers for friday?");
  });
  test("stem from question words", () => {
    const p = parsePoll("should we get pizza or burgers");
    expect(p.options).toEqual(["Pizza", "Burgers"]);
    expect(p.title).toBe("Should we get?");
  });
  test("colon stem", () => {
    const p = parsePoll("lunch: thai, sushi or tacos");
    expect(p.title).toBe("Lunch?");
    expect(p.options).toEqual(["Thai", "Sushi", "Tacos"]);
  });
  test("vs", () => expect(parsePoll("tabs vs spaces").options).toEqual(["Tabs", "Spaces"]));
  test("no options", () => expect(parsePoll("pizza").options).toEqual([]));
});

describe("contact", () => {
  test("rahul 98200 12345 rahul@mail.com", () => {
    const c = parseContact("rahul 98200 12345 rahul@mail.com");
    expect(c).toEqual({ name: "Rahul", phone: "98200 12345", email: "rahul@mail.com", initials: "R" });
  });
  test("+91", () => expect(parseContact("anna sharma +91 98765 43210").phone).toBe("+91 98765 43210"));
  test("initials", () => expect(parseContact("anna sharma a@b.co").initials).toBe("AS"));
  test("email only", () => expect(parseContact("sam@x.io").name).toBe(""));
  test("save prefix", () => expect(parseContact("save priya 9820012345").name).toBe("Priya"));
});

describe("link", () => {
  test("https://vercel.com/blog check later", () => {
    const l = parseLink("https://vercel.com/blog check later");
    expect(l.domain).toBe("vercel.com");
    expect(l.monogram).toBe("V");
    expect(l.note).toBe("Check later");
  });
  test("www", () => expect(parseLink("www.example.org").domain).toBe("example.org"));
  test("bare domain", () => expect(parseLink("read linear.app/method").url).toBe("https://linear.app/method"));
  test("trailing punctuation", () => expect(parseLink("see https://a.dev/x.").url).toBe("https://a.dev/x"));
  test("no url", () => expect(parseLink("nothing here").url).toBeNull());
});

describe("note", () => {
  test("single line", () => expect(parseNote("thinking about moving to a smaller place").title).toBe("Thinking about moving to a smaller place"));
  test("multi line", () => expect(parseNote("idea\nbuild a thing")).toEqual({ title: "Idea", body: "build a thing" }));
  test("sentences", () => expect(parseNote("Big day today. Shipped the thing and it went well").body).toBe("Shipped the thing and it went well"));
  test("empty", () => expect(parseNote("").title).toBe(""));
  test("trims", () => expect(parseNote("  hello   world ").title).toBe("Hello world"));
});

import { parseCountdown } from "../parse/countdown";
import { dayShift, formatIn, parseTimezone, wallTimeToInstant } from "../parse/timezone";
import { parseRandom, rollRandom } from "../parse/random";
import { parseGoal } from "../parse/goal";

describe("countdown", () => {
  test("days until christmas", () => expect(parseCountdown("days until christmas", REF)).toMatchObject({ title: "Christmas", days: 94 }));
  test("holiday already passed rolls to next year", () => expect(parseCountdown("halloween", new Date(2026, 10, 5)).date?.getFullYear()).toBe(2027));
  test("dated event", () => {
    const c = parseCountdown("how many days till my birthday on dec 12", REF);
    expect(c.days).toBe(81);
    expect(c.title).toBe("My birthday");
  });
  test("tomorrow", () => expect(parseCountdown("countdown to launch tomorrow", REF).days).toBe(1));
  test("nothing", () => expect(parseCountdown("countdown", REF).days).toBeNull());
});

describe("timezone", () => {
  const at = new Date(Date.UTC(2026, 0, 15, 12, 0)); // January: no DST in the US
  test("3pm pst in ist", () => {
    const tz = parseTimezone("3pm pst in ist", at);
    expect(tz.from.tz).toBe("America/Los_Angeles");
    expect(tz.to?.tz).toBe("Asia/Kolkata");
    expect(formatIn("America/Los_Angeles", tz.instant!)).toBe("3:00 PM");
    expect(formatIn("Asia/Kolkata", tz.instant!)).toBe("4:30 AM");
    expect(dayShift("America/Los_Angeles", "Asia/Kolkata", tz.instant!)).toBe(1);
  });
  test("time in tokyo is now, local → tokyo", () => {
    const tz = parseTimezone("what time is it in tokyo", at);
    expect(tz.isNow).toBe(true);
    expect(tz.to?.label).toBe("Tokyo");
  });
  test("single zone after a time is the source", () => expect(parseTimezone("9am london", at).from.label).toBe("London"));
  test("24h clock", () => expect(formatIn("Europe/Paris", parseTimezone("14:30 paris to new york", at).instant!)).toBe("2:30 PM"));
  test("DST-aware wall time", () => {
    const summer = new Date(Date.UTC(2026, 6, 1, 12));
    expect(formatIn("America/New_York", wallTimeToInstant("America/New_York", 9, 0, summer))).toBe("9:00 AM");
  });
});

describe("random", () => {
  test("2d6", () => expect(parseRandom("roll 2d6")).toEqual({ kind: "dice", count: 2, sides: 6 }));
  test("a die", () => expect(parseRandom("roll a die")).toEqual({ kind: "dice", count: 1, sides: 6 }));
  test("coin", () => expect(parseRandom("flip a coin")).toEqual({ kind: "coin" }));
  test("range", () => expect(parseRandom("random number 1-100")).toEqual({ kind: "number", min: 1, max: 100 }));
  test("pick", () => expect(parseRandom("pick one: tacos, sushi or pizza")).toEqual({ kind: "pick", options: ["Tacos", "Sushi", "Pizza"] }));
  test("rolls stay in range", () => {
    const rolls = Array.from({ length: 200 }, () => Number(rollRandom({ kind: "dice", count: 1, sides: 6 })[0]));
    expect(Math.min(...rolls)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...rolls)).toBeLessThanOrEqual(6);
  });
});

describe("goal", () => {
  test("read 12 books this year, 4 done", () => expect(parseGoal("read 12 books this year, 4 done")).toMatchObject({ current: 4, target: 12, unit: "books" }));
  test("x of y", () => expect(parseGoal("4 of 10 workouts")).toMatchObject({ current: 4, target: 10 }));
  test("slash", () => expect(parseGoal("pages 120/300")).toMatchObject({ current: 120, target: 300 }));
  test("money with k", () => expect(parseGoal("save 50k for a trip, saved 12k")).toMatchObject({ current: 12000, target: 50000 }));
  test("no target", () => expect(parseGoal("learn piano").target).toBeNull());
});

import { composeRtcfc, parseRtcfc, rollRtcfc, RTCFC_SAMPLES } from "../parse/rtcfc";

describe("rtcfc", () => {
  test("one-liner marketing", () => {
    const d = parseRtcfc(
      "Role: senior marketer. Task: write 3 Zalo messages. Context: SME HCMC. Format: ≤400 chars VN. Constraints: no emojis in first line",
    );
    expect(d).toEqual({
      role: "senior marketer",
      task: "write 3 Zalo messages",
      context: "SME HCMC",
      format: "≤400 chars VN",
      constraints: "no emojis in first line",
    });
  });
  test("multiline with markdown bold", () => {
    const d = parseRtcfc(`**Role:** You are a staff engineer reviewing a NestJS pull request.
**Task:** Identify correctness bugs and security risks.
**Context:** Monorepo with apps/api and packages/shared.
**Format:** Markdown table with Severity P0–P3.
**Constraints:** Skip style nits. Max 15 findings.`);
    expect(d.role).toContain("staff engineer");
    expect(d.task).toContain("correctness bugs");
    expect(d.context).toContain("Monorepo");
    expect(d.format).toContain("Markdown table");
    expect(d.constraints).toContain("Skip style nits");
  });
  test("bare rtcfc", () =>
    expect(parseRtcfc("rtcfc")).toEqual({ role: "", task: "", context: "", format: "", constraints: "" }));
  test("partial Role+Task", () => {
    const d = parseRtcfc("Role: CEO brief. Task: enter mid-market?");
    expect(d.role).toBe("CEO brief");
    expect(d.task).toBe("enter mid-market?");
    expect(d.context).toBe("");
    expect(d.format).toBe("");
    expect(d.constraints).toBe("");
  });
  test("compose", () => {
    expect(
      composeRtcfc({
        role: "a",
        task: "b",
        context: "c",
        format: "d",
        constraints: "e",
      }),
    ).toBe("Role: a\nTask: b\nContext: c\nFormat: d\nConstraints: e");
  });
  test("samples are complete", () => {
    for (const s of RTCFC_SAMPLES) {
      expect(s.role.trim()).toBeTruthy();
      expect(s.task.trim()).toBeTruthy();
      expect(s.context.trim()).toBeTruthy();
      expect(s.format.trim()).toBeTruthy();
      expect(s.constraints.trim()).toBeTruthy();
    }
  });
  test("roll avoids immediate repeat", () => {
    const first = RTCFC_SAMPLES[0]!;
    const next = rollRtcfc(() => 0, first);
    expect(next).not.toEqual(first);
  });
  test("compose(parse(compose(sample))) round-trips fields", () => {
    const sample = RTCFC_SAMPLES[0]!;
    expect(parseRtcfc(composeRtcfc(sample))).toEqual(sample);
  });
});

import { BCMT_CORE, BCMT_SAMPLES, composeBcmt, parseBcmt, rollBcmt } from "../parse/bcmt";

describe("bcmt", () => {
  test("one-liner SME email sample", () => {
    const d = parseBcmt(
      "Bối cảnh: Royal Solution CRM SME. Con người: CSM 5 năm; chủ SME bận. Mục tiêu: email kích hoạt trial, đặt demo 15 phút. Tiêu chuẩn: ≤120 từ, tiếng Việt, không emoji",
    );
    expect(d.context).toContain("Royal Solution");
    expect(d.people).toContain("CSM");
    expect(d.goal).toContain("email kích hoạt");
    expect(d.standards).toContain("≤120 từ");
    expect(d.input).toBe("");
  });
  test("tagged skeleton with input", () => {
    const d = parseBcmt(`<bối_cảnh>
Monorepo NestJS + Next.js.
</bối_cảnh>

<con_người>
Bạn là staff engineer 10 năm NestJS.
Người đọc là dev tác giả PR.
</con_người>

<mục_tiêu>
Chỉ ra lỗi correctness trong diff.
</mục_tiêu>

<tiêu_chuẩn>
- Định dạng: bảng Markdown
- Tối đa 15 finding
</tiêu_chuẩn>

<đầu_vào>
{diff}
</đầu_vào>`);
    expect(d.context).toContain("Monorepo NestJS");
    expect(d.people).toContain("staff engineer");
    expect(d.goal).toContain("correctness");
    expect(d.standards).toContain("bảng Markdown");
    expect(d.standards).toContain("15 finding");
    expect(d.input).toBe("{diff}");
  });
  test("bare bcmt", () =>
    expect(parseBcmt("bcmt")).toEqual({ context: "", people: "", goal: "", standards: "", input: "" }));
  test("english aliases", () => {
    const d = parseBcmt("Context: SaaS ERP. People: QA engineer. Goal: generate test cases. Standards: JSON only");
    expect(d).toEqual({
      context: "SaaS ERP",
      people: "QA engineer",
      goal: "generate test cases",
      standards: "JSON only",
      input: "",
    });
  });
  test("compose omits empty input", () => {
    expect(
      composeBcmt({
        context: "a",
        people: "b",
        goal: "c",
        standards: "d",
        input: "",
      }),
    ).toBe(`<bối_cảnh>
a
</bối_cảnh>

<con_người>
b
</con_người>

<mục_tiêu>
c
</mục_tiêu>

<tiêu_chuẩn>
d
</tiêu_chuẩn>`);
  });
  test("samples have complete cores", () => {
    for (const s of BCMT_SAMPLES) {
      for (const k of BCMT_CORE) expect(s[k].trim()).toBeTruthy();
    }
  });
  test("roll avoids immediate repeat", () => {
    const first = BCMT_SAMPLES[0]!;
    const next = rollBcmt(() => 0, first);
    expect(next).not.toEqual(first);
  });
  test("compose(parse(compose(sample))) round-trips fields", () => {
    const sample = BCMT_SAMPLES[1]!;
    expect(parseBcmt(composeBcmt(sample))).toEqual(sample);
  });
  test("compose includes input when set", () => {
    expect(
      composeBcmt({
        context: "a",
        people: "b",
        goal: "c",
        standards: "d",
        input: "{ticket}",
      }),
    ).toContain("<đầu_vào>\n{ticket}\n</đầu_vào>");
  });
});

import { parseTriage } from "../parse/triage";
import { parseClassify } from "../parse/classify";
import { parseModerate } from "../parse/moderate";
import { parseEval } from "../parse/eval";
import { priorityFromScore, qualityLabel } from "../parse/priority";
import { DOC_CATEGORIES } from "../jev/types";

describe("triage", () => {
  test("labeled fields", () => {
    const d = parseTriage("Title: Payment failed. Report: Charged twice. Service: Billing API");
    expect(d.title).toBe("Payment failed");
    expect(d.report).toBe("Charged twice");
    expect(d.context).toBe("Billing API");
  });
  test("multiline free text", () => {
    const d = parseTriage("Checkout outage\nUsers cannot pay on mobile");
    expect(d.title).toBe("Checkout outage");
    expect(d.report).toContain("cannot pay");
  });
  test("bare keyword", () => expect(parseTriage("triage")).toEqual({ title: "", report: "", context: "" }));
});

describe("classify", () => {
  test("body with categories line", () => {
    const d = parseClassify("Q3 invoice for Acme Corp.\nCategories: finance, legal, hr");
    expect(d.body).toContain("invoice");
    expect(d.categories).toEqual(["finance", "legal", "hr"]);
  });
  test("defaults to built-in categories", () => {
    const d = parseClassify("classify this product roadmap draft for Q4");
    expect(d.body.toLowerCase()).toContain("roadmap");
    expect(d.categories).toEqual([...DOC_CATEGORIES]);
  });
});

describe("moderate", () => {
  test("labeled content and policy", () => {
    const d = parseModerate("Content: You should be fired. Policy: No personal attacks");
    expect(d.content).toContain("fired");
    expect(d.policy).toContain("personal attacks");
  });
  test("plain content", () => {
    expect(parseModerate("moderate this toxic slur in chat")).toMatchObject({ content: expect.stringContaining("toxic") });
  });
});

describe("eval", () => {
  test("request answer reference", () => {
    const d = parseEval("Request: What is our refund window? Answer: 14 days. Reference: Help center §3");
    expect(d.request).toContain("refund");
    expect(d.answer).toContain("14 days");
    expect(d.reference).toContain("Help center");
  });
  test("incomplete without labels", () => expect(parseEval("evaluate this")).toEqual({ request: "", answer: "", reference: "" }));
});

describe("priority helpers", () => {
  test("score bands", () => {
    expect(priorityFromScore(0)).toBe("p3");
    expect(priorityFromScore(1)).toBe("p2");
    expect(priorityFromScore(2)).toBe("p1");
    expect(priorityFromScore(3)).toBe("p0");
  });
  test("quality labels", () => {
    expect(qualityLabel(0)).toBe("Poor");
    expect(qualityLabel(1)).toBe("Acceptable");
    expect(qualityLabel(2)).toBe("Good");
  });
});

import { parseRoute } from "../parse/route";
import { parseApprove } from "../parse/approve";
import { parseWorkout } from "../parse/workout";
import { emiAmounts, parseEmi } from "../parse/emi";
import { parseRecipe } from "../parse/recipe";

describe("route", () => {
  test("labeled subject and owners", () => {
    const d = parseRoute("Subject: New vendor signup. Fields: company, tax id. Owners: Maya, Billing queue");
    expect(d.subject).toBe("New vendor signup");
    expect(d.fields).toContain("company");
    expect(d.owners).toEqual(["Maya", "Billing Queue"]);
  });
  test("bare keyword", () => expect(parseRoute("route")).toEqual({ subject: "", fields: "", owners: [] }));
});

describe("approve", () => {
  test("labeled tool and args", () => {
    const d = parseApprove('Tool: send_email. Args: {"to":"user@acme.com"}. Rationale: welcome drip');
    expect(d.tool).toBe("send_email");
    expect(d.args).toContain("user@acme.com");
    expect(d.rationale).toContain("welcome");
  });
  test("call shape", () => {
    const d = parseApprove("approve send_email({\"to\":\"a@b.com\"})");
    expect(d.tool).toBe("send_email");
    expect(d.args).toContain("a@b.com");
  });
});

describe("workout", () => {
  test("3x10 with weight", () => {
    const d = parseWorkout("3x10 bench press 60kg");
    expect(d.sets).toBe(3);
    expect(d.reps).toBe(10);
    expect(d.weight).toBe(60);
    expect(d.unit).toBe("kg");
    expect(d.exercise.toLowerCase()).toContain("bench");
  });
  test("sets of", () => {
    const d = parseWorkout("squats 5 sets of 5 at 100kg");
    expect(d.sets).toBe(5);
    expect(d.reps).toBe(5);
    expect(d.weight).toBe(100);
    expect(d.exercise.toLowerCase()).toContain("squat");
  });
  test("bare keyword", () => expect(parseWorkout("workout")).toEqual({ exercise: "", sets: null, reps: null, weight: null, unit: null }));
});

describe("emi", () => {
  test("lakh and years", () => {
    const d = parseEmi("emi on 5 lakh at 9% for 5 years");
    expect(d.principal).toBe(500_000);
    expect(d.annualRate).toBe(9);
    expect(d.tenureMonths).toBe(60);
  });
  test("months and dollars", () => {
    const d = parseEmi("loan $50000 at 8.5% for 36 months");
    expect(d.principal).toBe(50_000);
    expect(d.annualRate).toBe(8.5);
    expect(d.tenureMonths).toBe(36);
    expect(d.currency).toBe("$");
  });
  test("emiAmounts known value", () => {
    const { monthly } = emiAmounts({ principal: 500_000, annualRate: 9, tenureMonths: 60 });
    expect(monthly).not.toBeNull();
    expect(monthly!).toBeGreaterThan(10_000);
    expect(monthly!).toBeLessThan(11_000);
  });
});

describe("recipe", () => {
  test("with ingredients and servings", () => {
    const d = parseRecipe("pasta with garlic, tomato and olive oil for 2");
    expect(d.title.toLowerCase()).toContain("pasta");
    expect(d.servings).toBe(2);
    expect(d.ingredients.length).toBeGreaterThanOrEqual(3);
  });
  test("labeled ingredients", () => {
    const d = parseRecipe("ingredients: eggs, flour, milk — pancakes");
    expect(d.ingredients.map((i) => i.toLowerCase())).toEqual(expect.arrayContaining(["eggs", "flour", "milk"]));
  });
  test("bare keyword", () => expect(parseRecipe("recipe")).toEqual({ title: "", ingredients: [], servings: null }));
});

import { parseNews, parseNewsSlash } from "../parse/news";

describe("news", () => {
  test("critical topic", () => {
    expect(parseNews("critical news on AI regulation")).toEqual({
      topic: "AI regulation",
      criticalOnly: true,
      sourceHint: null,
    });
  });
  test("source hint", () => {
    expect(parseNews("news about climate from Reuters")).toEqual({
      topic: "Climate",
      criticalOnly: false,
      sourceHint: "Reuters",
    });
  });
  test("headlines lead-in", () => {
    expect(parseNews("headlines on semiconductor supply").topic.toLowerCase()).toContain("semiconductor");
  });
  test("bare news", () => expect(parseNews("news")).toEqual({ topic: "", criticalOnly: false, sourceHint: null }));
});

describe("news slash", () => {
  const sources = ["Reuters", "BBC News", "CNN"];

  test("non-slash is inactive", () => {
    expect(parseNewsSlash("climate", sources)).toEqual({
      isSlash: false,
      filterQuery: "",
      sourceHint: null,
      topic: "",
      criticalOnly: false,
      matched: false,
    });
  });

  test("bare slash opens palette", () => {
    expect(parseNewsSlash("/", sources)).toEqual({
      isSlash: true,
      filterQuery: "",
      sourceHint: null,
      topic: "",
      criticalOnly: false,
      matched: false,
    });
  });

  test("prefix filters without matching", () => {
    expect(parseNewsSlash("/reu", sources)).toMatchObject({
      isSlash: true,
      filterQuery: "reu",
      sourceHint: null,
      matched: false,
    });
  });

  test("exact source match", () => {
    expect(parseNewsSlash("/Reuters", sources)).toEqual({
      isSlash: true,
      filterQuery: "Reuters",
      sourceHint: "Reuters",
      topic: "",
      criticalOnly: false,
      matched: true,
    });
  });

  test("source plus keywords", () => {
    expect(parseNewsSlash("/reuters climate", sources)).toEqual({
      isSlash: true,
      filterQuery: "reuters climate",
      sourceHint: "Reuters",
      topic: "Climate",
      criticalOnly: false,
      matched: true,
    });
  });

  test("multi-word source plus keywords", () => {
    expect(parseNewsSlash("/bbc news politics", sources)).toEqual({
      isSlash: true,
      filterQuery: "bbc news politics",
      sourceHint: "BBC News",
      topic: "Politics",
      criticalOnly: false,
      matched: true,
    });
  });

  test("critical keywords", () => {
    expect(parseNewsSlash("/cnn critical AI", sources)).toMatchObject({
      isSlash: true,
      sourceHint: "CNN",
      topic: "AI",
      criticalOnly: true,
      matched: true,
    });
  });

  test("prefers longest source name", () => {
    expect(parseNewsSlash("/bbc news", ["BBC", "BBC News"]).sourceHint).toBe("BBC News");
  });
});
