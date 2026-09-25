import {
  AlarmClock,
  CalendarClock,
  Dices,
  Flag,
  FolderOpen,
  Gauge,
  GitBranch,
  Globe,
  Target,
  Bell,
  Briefcase,
  CalendarDays,
  Calculator,
  CircleAlert,
  Coffee,
  Contact,
  Focus,
  Link2,
  ListChecks,
  MessageSquareQuote,
  Layers,
  Palette,
  Repeat,
  Ruler,
  Receipt,
  Scale,
  ShieldCheck,
  ShoppingCart,
  StickyNote,
  Sun,
  Timer,
  Users,
  UtensilsCrossed,
  Vote,
  Wallet,
  Dumbbell,
  Landmark,
} from "lucide-react";
import type { CardIntent } from "@/lib/jev/types";
import { formatAmount } from "@/lib/parse/common";
import { UNIT_LABELS } from "@/lib/parse/convert";
import { tipAmounts } from "@/lib/parse/tip";
import { formatClock } from "@/lib/parse/timer";
import { describeRandom } from "@/lib/parse/random";
import { formatIn } from "@/lib/parse/timezone";
import { PRIORITY_LABEL } from "@/lib/parse/priority";
import type { GatedSignals } from "@/lib/signals";
import { ApproveCard } from "./ApproveCard";
import { CalcCard } from "./CalcCard";
import { ClassifyCard } from "./ClassifyCard";
import { CountdownCard } from "./CountdownCard";
import { EmiCard } from "./EmiCard";
import { EvalCard } from "./EvalCard";
import { GoalCard } from "./GoalCard";
import { ModerateCard } from "./ModerateCard";
import { RandomCard } from "./RandomCard";
import { RecipeCard } from "./RecipeCard";
import { RouteCard } from "./RouteCard";
import { TimezoneCard } from "./TimezoneCard";
import { TriageCard } from "./TriageCard";
import { WorkoutCard } from "./WorkoutCard";
import { ColorPicker } from "./ColorPicker";
import { ContactCard } from "./ContactCard";
import { ConvertCard } from "./ConvertCard";
import { EventCard } from "./EventCard";
import { ExpenseRow } from "./ExpenseRow";
import { HabitCard } from "./HabitCard";
import { CATEGORY_ICON, TRANSPORT_ICON } from "./icons";
import { LinkCard } from "./LinkCard";
import { NoteCard } from "./NoteCard";
import { PollCard } from "./PollCard";
import { ReminderPill } from "./ReminderPill";
import { RtcfcCard } from "./RtcfcCard";
import { BcmtCard } from "./BcmtCard";
import { formatWhen } from "./shared";
import { SplitCard } from "./SplitCard";
import { TipCard } from "./TipCard";
import { TimerRing } from "./TimerRing";
import { TodoList } from "./TodoList";
import { TravelCard } from "./TravelCard";
import type { BadgeSpec, Registry } from "./types";

const repeats = (s: GatedSignals): BadgeSpec[] => (s.recurring ? [{ id: "repeat", label: "Repeats", icon: Repeat }] : []);
const urgent = (s: GatedSignals): BadgeSpec[] => (s.urgent ? [{ id: "urgent", label: "Urgent", icon: CircleAlert, tone: "caution" }] : []);

const TONE_LABEL = {
  neutral: "Note",
  positive: "Upbeat note",
  excited: "Excited note",
  stressed: "Stressed note",
  reflective: "Reflective note",
} as const;

const TONE_EDGE = {
  neutral: null,
  positive: "var(--positive)",
  excited: "var(--brand)",
  stressed: "var(--caution)",
  reflective: "var(--line-strong)",
} as const;

/**
 * intent → everything needed to render it. Adding a UI type means one entry here,
 * one criterion in questions.ts, one parser and one component.
 */
export const registry: Registry = {
  event: {
    label: "Event",
    example: "dinner with priya friday 8pm",
    icon: CalendarDays,
    signals: ["eventMode", "recurring"],
    badges: repeats,
    summary: (d) => [d.title || "Event", d.date && Object.values(formatWhen(d.date, d.hasTime)).filter(Boolean).join(", ")].filter(Boolean).join(" · "),
    Component: EventCard,
  },
  reminder: {
    label: "Reminder",
    example: "remind me to call mom tomorrow",
    icon: Bell,
    signals: ["urgency", "recurring"],
    badges: (s) => [...urgent(s), ...repeats(s)],
    edge: (s) => (s.urgent ? "var(--caution)" : null),
    summary: (d) => [d.task || "Reminder", d.when && formatWhen(d.when, d.hasTime).day].filter(Boolean).join(" · "),
    Component: ReminderPill,
  },
  todo: {
    label: "Checklist",
    example: "buy milk, eggs, bread and coffee",
    icon: ListChecks,
    signals: ["isShoppingList", "urgency"],
    headerIcon: (s) => (s.isShoppingList ? ShoppingCart : ListChecks),
    headerLabel: (s) => (s.isShoppingList ? "Shopping" : "Checklist"),
    badges: urgent,
    summary: (d) => `${d.items.length} item${d.items.length === 1 ? "" : "s"} · ${d.items.slice(0, 3).join(", ")}`,
    Component: TodoList,
  },
  timer: {
    label: "Timer",
    example: "25 min focus",
    icon: Timer,
    signals: ["timerKind"],
    headerIcon: (s) => (s.timerKind === "focus" ? Focus : s.timerKind === "break" ? Coffee : s.timerKind === "stopwatch" ? AlarmClock : Timer),
    headerLabel: (s) => (s.timerKind === "focus" ? "Focus" : s.timerKind === "break" ? "Break" : s.timerKind === "stopwatch" ? "Stopwatch" : "Timer"),
    summary: (d) => [d.label || "Timer", d.seconds && formatClock(d.seconds)].filter(Boolean).join(" · "),
    Component: TimerRing,
  },
  habit: {
    label: "Habit",
    example: "meditate every morning",
    icon: Sun,
    signals: [],
    summary: (d) => [d.title || "Habit", d.label].filter(Boolean).join(" · "),
    Component: HabitCard,
  },
  color: {
    label: "Color",
    example: "#ff6b35",
    icon: Palette,
    signals: ["colorMood"],
    summary: (d) => [d.name ? d.name[0].toUpperCase() + d.name.slice(1) : "Color", d.hex?.toUpperCase()].filter(Boolean).join(" · "),
    Component: ColorPicker,
  },
  split: {
    label: "Split",
    example: "split 2400 between 3",
    icon: Users,
    signals: [],
    summary: (d) =>
      d.total && d.people ? `${formatAmount(d.total, d.currency)} ÷ ${d.people} = ${formatAmount(d.total / d.people, d.currency)} each` : "Split",
    Component: SplitCard,
  },
  tip: {
    label: "Tip",
    example: "tip 18% on 2400 for 4",
    icon: Receipt,
    signals: [],
    summary: (d) => {
      if (d.total === null || d.tipPercent === null) return "Tip";
      const { tip, grand, each } = tipAmounts(d);
      if (each !== null) return `${d.tipPercent}% → ${formatAmount(each, d.currency)} each`;
      return `${d.tipPercent}% of ${formatAmount(d.total, d.currency)} = ${formatAmount(tip, d.currency)} · ${formatAmount(grand, d.currency)} total`;
    },
    Component: TipCard,
  },
  expense: {
    label: "Expense",
    example: "spent 450 on uber",
    icon: Wallet,
    signals: ["expenseCategory"],
    headerIcon: (s) => (s.expenseCategory ? CATEGORY_ICON[s.expenseCategory] : Wallet),
    summary: (d) => [d.amount !== null && formatAmount(d.amount, d.currency), d.item].filter(Boolean).join(" · ") || "Expense",
    Component: ExpenseRow,
  },
  convert: {
    label: "Convert",
    example: "5 miles in km",
    icon: Ruler,
    signals: [],
    summary: (d) =>
      d.value !== null && d.from && d.to && d.result !== null
        ? `${d.value} ${UNIT_LABELS[d.from] ?? d.from} = ${Number(d.result.toFixed(2))} ${UNIT_LABELS[d.to] ?? d.to}`
        : "Conversion",
    Component: ConvertCard,
  },
  calc: {
    label: "Calculate",
    example: "18% of 3450",
    icon: Calculator,
    signals: [],
    summary: (d) => (d.result !== null ? `${d.expression} = ${d.result.toLocaleString("en-US")}` : d.expression),
    Component: CalcCard,
  },
  travel: {
    label: "Trip",
    example: "flight to goa next weekend",
    icon: TRANSPORT_ICON.flight,
    signals: ["transport", "tripType"],
    headerIcon: (s) => TRANSPORT_ICON[s.transport ?? "unspecified"],
    badges: (s) =>
      s.tripType === "work"
        ? [{ id: "work", label: "Work", icon: Briefcase }]
        : s.tripType === "leisure"
          ? [{ id: "leisure", label: "Leisure", icon: Sun }]
          : [],
    summary: (d) => (d.destination ? `Trip to ${d.destination}` : "Trip"),
    Component: TravelCard,
  },
  poll: {
    label: "Poll",
    example: "pizza or burgers for friday?",
    icon: Vote,
    signals: ["hasExplicitOptions"],
    summary: (d) => d.title || d.options.join(" / ") || "Poll",
    Component: PollCard,
  },
  contact: {
    label: "Contact",
    example: "rahul 98200 12345 rahul@mail.com",
    icon: Contact,
    signals: [],
    summary: (d) => [d.name || "Contact", d.phone ?? d.email].filter(Boolean).join(" · "),
    Component: ContactCard,
  },
  link: {
    label: "Bookmark",
    example: "https://vercel.com/blog check later",
    icon: Link2,
    signals: [],
    summary: (d) => [d.domain ?? "Link", d.note].filter(Boolean).join(" · "),
    Component: LinkCard,
  },
  countdown: {
    label: "Countdown",
    example: "days until christmas",
    icon: CalendarClock,
    signals: [],
    summary: (d) =>
      d.days === null ? d.title || "Countdown" : d.days === 0 ? `${d.title || "It"} is today` : `${Math.abs(d.days)} days ${d.days < 0 ? "since" : "until"} ${d.title || "then"}`,
    Component: CountdownCard,
  },
  timezone: {
    label: "Time zone",
    example: "3pm pst in ist",
    icon: Globe,
    signals: [],
    summary: (d) =>
      d.to && d.instant ? `${formatIn(d.from.tz, d.instant)} ${d.from.label} → ${formatIn(d.to.tz, d.instant)} ${d.to.label}` : "Time zones",
    Component: TimezoneCard,
  },
  random: {
    label: "Random",
    example: "roll 2d6",
    icon: Dices,
    signals: [],
    summary: (d) => describeRandom(d),
    Component: RandomCard,
  },
  goal: {
    label: "Goal",
    example: "read 12 books this year, 4 done",
    icon: Target,
    signals: [],
    summary: (d) => (d.target ? `${d.title || "Goal"} · ${d.current}/${d.target}${d.unit ? ` ${d.unit}` : ""}` : d.title || "Goal"),
    Component: GoalCard,
  },
  rtcfc: {
    label: "RTCFC",
    example: "Role: staff engineer. Task: review this PR. Context: NestJS. Format: severity table. Constraints: skip style nits",
    icon: MessageSquareQuote,
    signals: [],
    summary: (d) => d.task || d.role || "RTCFC",
    Component: RtcfcCard,
  },
  bcmt: {
    label: "BCMT",
    example:
      "Bối cảnh: CRM SME Việt. Con người: CSM 5 năm; chủ SME bận. Mục tiêu: email kích hoạt trial, đặt demo 15 phút. Tiêu chuẩn: ≤120 từ, tiếng Việt, không emoji",
    icon: Layers,
    signals: [],
    summary: (d) => d.goal || d.context || "BCMT",
    Component: BcmtCard,
  },
  triage: {
    label: "Triage",
    example: "Title: Payment failed. Report: Customer charged twice for March. Service: Billing API. Triage this ticket",
    icon: Gauge,
    signals: ["ticketPriority", "urgency"],
    badges: (s) => [...urgent(s), ...(s.priorityLevel === "p0" || s.priorityLevel === "p1" ? [{ id: "pri", label: PRIORITY_LABEL[s.priorityLevel], icon: CircleAlert, tone: "caution" as const }] : [])],
    edge: (s) => (s.priorityLevel === "p0" || s.urgent ? "var(--caution)" : null),
    summary: (d) => d.title || d.report.slice(0, 40) || "Triage",
    Component: TriageCard,
  },
  classify: {
    label: "Classify",
    example: "Classify this document. Q3 invoice for Acme Corp totaling $12,400. Categories: finance, legal, hr, product",
    icon: FolderOpen,
    signals: ["docCategory"],
    summary: (d) => d.body.slice(0, 48) || "Classify",
    Component: ClassifyCard,
  },
  moderate: {
    label: "Moderate",
    example: "Content: You should be fired idiot. Policy: No personal attacks. Flag for moderator if needed",
    icon: Flag,
    signals: ["needsModeration"],
    badges: (s) => (s.needsModeration ? [{ id: "flag", label: "Flag", icon: Flag, tone: "caution" }] : []),
    edge: (s) => (s.needsModeration ? "var(--caution)" : null),
    summary: (d) => d.content.slice(0, 48) || "Moderate",
    Component: ModerateCard,
  },
  eval: {
    label: "Eval",
    example: "Request: What is our refund window? Answer: 14 days from purchase. Reference: Help center §3. Evaluate this answer",
    icon: Scale,
    signals: ["answerQuality", "needsRevision"],
    badges: (s) => (s.needsRevision || s.answerQuality < 0.75 ? [{ id: "rev", label: "Revise", icon: CircleAlert, tone: "caution" }] : []),
    edge: (s) => (s.needsRevision || s.answerQuality < 0.75 ? "var(--caution)" : "var(--positive)"),
    summary: (d) => d.request.slice(0, 40) || d.answer.slice(0, 40) || "Eval",
    Component: EvalCard,
  },
  route: {
    label: "Route",
    example: "Subject: New vendor signup. Fields: company, tax id. Owners: Maya, Billing queue. Route this form",
    icon: GitBranch,
    signals: ["routeDecision"],
    badges: (s) =>
      s.routeDecision === "another_review"
        ? [{ id: "review", label: "Another review", icon: Users }]
        : s.routeDecision === "assign"
          ? [{ id: "assign", label: "Assign", icon: Users }]
          : [],
    summary: (d) => d.subject || (d.owners[0] ? `Route → ${d.owners[0]}` : "Route"),
    Component: RouteCard,
  },
  approve: {
    label: "Approve",
    example: 'Tool: send_email. Args: {"to":"user@acme.com","subject":"Welcome"}. Pause for approval',
    icon: ShieldCheck,
    signals: ["toolApproval"],
    badges: (s) =>
      s.toolApproval === "pause"
        ? [{ id: "pause", label: "Paused", icon: CircleAlert, tone: "caution" }]
        : s.toolApproval === "allow"
          ? [{ id: "allow", label: "Allow", icon: ShieldCheck }]
          : [],
    edge: (s) => (s.toolApproval === "pause" ? "var(--caution)" : s.toolApproval === "allow" ? "var(--positive)" : null),
    summary: (d) => d.tool || "Approve",
    Component: ApproveCard,
  },
  workout: {
    label: "Workout",
    example: "3x10 bench press 60kg",
    icon: Dumbbell,
    signals: [],
    summary: (d) =>
      [d.exercise || "Workout", d.sets && d.reps ? `${d.sets}×${d.reps}` : null, d.weight != null ? `${d.weight}${d.unit ?? ""}` : null]
        .filter(Boolean)
        .join(" · "),
    Component: WorkoutCard,
  },
  emi: {
    label: "EMI",
    example: "emi on 5 lakh at 9% for 5 years",
    icon: Landmark,
    signals: [],
    summary: (d) =>
      [d.principal != null ? formatAmount(d.principal, d.currency) : "EMI", d.annualRate != null ? `${d.annualRate}%` : null, d.tenureMonths ? `${d.tenureMonths} mo` : null]
        .filter(Boolean)
        .join(" · "),
    Component: EmiCard,
  },
  recipe: {
    label: "Recipe",
    example: "pasta with garlic, tomato and olive oil for 2",
    icon: UtensilsCrossed,
    signals: [],
    summary: (d) =>
      [d.title || "Recipe", d.ingredients.length ? `${d.ingredients.length} ingredients` : null, d.servings ? `serves ${d.servings}` : null]
        .filter(Boolean)
        .join(" · "),
    Component: RecipeCard,
  },
  note: {
    label: "Note",
    example: "the city felt so quiet this morning",
    icon: StickyNote,
    signals: ["tone", "isQuestion"],
    // The edge color is always paired with a tone word in the header, never color alone.
    headerLabel: (s) => (s.tone ? TONE_LABEL[s.tone] : "Note"),
    edge: (s) => (s.tone ? TONE_EDGE[s.tone] : null),
    summary: (d) => d.title,
    Component: NoteCard,
  },
};

export const CARD_INTENTS = Object.keys(registry) as CardIntent[];
