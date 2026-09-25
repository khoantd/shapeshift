import { capitalize, collapse, tidy } from "./common";

export type WeightUnit = "kg" | "lb";

export type WorkoutData = {
  exercise: string;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  unit: WeightUnit | null;
};

const SETSXREPS = /\b(\d+)\s*[x×]\s*(\d+)\b/i;
const SETS_OF = /\b(\d+)\s*sets?\s*(?:of\s*)?(\d+)\b/i;
const REPS_SETS = /\b(\d+)\s*reps?\s*(?:[x×]|for|by)?\s*(\d+)\s*sets?\b/i;
const WEIGHT = /\b(\d+(?:\.\d+)?)\s*(kg|kgs|kilos?|lb|lbs|pounds?)\b/i;
const FILLER =
  /\b(workout|exercise|do|set|sets|rep|reps|at|with|of|the|a|an|lift|lifts|presses?)\b/gi;

function normalizeUnit(raw: string): WeightUnit {
  return /lb|pound/i.test(raw) ? "lb" : "kg";
}

export function parseWorkout(text: string): WorkoutData {
  let rest = collapse(text);
  let sets: number | null = null;
  let reps: number | null = null;
  let weight: number | null = null;
  let unit: WeightUnit | null = null;

  const w = rest.match(WEIGHT);
  if (w) {
    weight = Number(w[1]);
    unit = normalizeUnit(w[2]);
    rest = rest.replace(w[0], " ");
  }

  const sxr = rest.match(SETSXREPS);
  if (sxr) {
    sets = Number(sxr[1]);
    reps = Number(sxr[2]);
    rest = rest.replace(sxr[0], " ");
  } else {
    const so = rest.match(SETS_OF);
    if (so) {
      sets = Number(so[1]);
      reps = Number(so[2]);
      rest = rest.replace(so[0], " ");
    } else {
      const rs = rest.match(REPS_SETS);
      if (rs) {
        reps = Number(rs[1]);
        sets = Number(rs[2]);
        rest = rest.replace(rs[0], " ");
      }
    }
  }

  rest = rest.replace(FILLER, " ");
  const exercise = capitalize(tidy(rest));

  return {
    exercise,
    sets: sets && sets > 0 ? sets : null,
    reps: reps && reps > 0 ? reps : null,
    weight: weight !== null && Number.isFinite(weight) && weight > 0 ? weight : null,
    unit,
  };
}

export function completeWorkout(d: WorkoutData) {
  return (d.exercise ? 0.35 : 0) + (d.sets ? 0.3 : 0) + (d.reps ? 0.25 : 0) + (d.weight ? 0.1 : 0);
}
