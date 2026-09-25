import { capitalize, collapse, tidy } from "./common";

export type RecipeData = {
  title: string;
  ingredients: string[];
  servings: number | null;
};

const SERVINGS_RE = /\b(?:for|serves?|serving)\s+(\d+)\b|\b(\d+)\s*(?:servings?|people|pax)\b/i;
const FILLER = /^(?:recipe|cook|make|bake|prepare)\s*:?\s*/i;

function splitIngredients(raw: string): string[] {
  return raw
    .split(/\s*(?:,|;|\s&\s|\band\b|\n|[—–])\s*/i)
    .map((s) => s.trim().replace(/^[•\-–—]\s*/, "").replace(/[.!]+$/, ""))
    .filter((s) => s.length > 1 && !/^(with|and|or|the|a|an|of)$/i.test(s))
    .map(capitalize);
}

export function parseRecipe(text: string): RecipeData {
  let rest = collapse(text.replace(/\n/g, ", "));
  let servings: number | null = null;
  let title = "";
  let ingredients: string[] = [];

  const srv = rest.match(SERVINGS_RE);
  if (srv) {
    servings = Number(srv[1] ?? srv[2]);
    rest = rest.replace(srv[0], " ");
  }

  const labeled = rest.match(/\bingredients?\s*:\s*(.+)$/i);
  if (labeled) {
    const ingRaw = labeled[1];
    const dashTitle = ingRaw.match(/^(.+?)\s*[—–]\s*(.+)$/);
    if (dashTitle) {
      ingredients = splitIngredients(dashTitle[1]);
      title = tidy(dashTitle[2]);
    } else {
      ingredients = splitIngredients(ingRaw);
    }
    rest = rest.slice(0, labeled.index).replace(/[—–\-:,]+\s*$/, "");
  } else {
    const dash = rest.match(/^(.+?)\s*[—–\-]\s*(.+)$/);
    if (dash && /,|\band\b/i.test(dash[2])) {
      title = tidy(dash[1].replace(FILLER, ""));
      ingredients = splitIngredients(dash[2]);
      rest = "";
    } else {
      const withM = rest.match(/^(.+?)\s+with\s+(.+)$/i);
      if (withM) {
        title = tidy(withM[1].replace(FILLER, ""));
        ingredients = splitIngredients(withM[2]);
        rest = "";
      }
    }
  }

  if (!title && rest) {
    rest = rest.replace(FILLER, "");
    // "pancakes: eggs, flour, milk"
    const colon = rest.match(/^([^:]+):\s*(.+)$/);
    if (colon && /,|\band\b/i.test(colon[2])) {
      title = tidy(colon[1]);
      ingredients = splitIngredients(colon[2]);
    } else if (!ingredients.length && /,|\band\b/i.test(rest)) {
      ingredients = splitIngredients(rest);
    } else {
      title = tidy(rest);
    }
  }

  if (!title && ingredients.length) {
    title = "";
  }

  return {
    title: title ? capitalize(title) : "",
    ingredients,
    servings: servings && servings > 0 ? servings : null,
  };
}

export function completeRecipe(d: RecipeData) {
  return (d.title ? 0.35 : 0) + Math.min(0.5, d.ingredients.length * 0.15) + (d.servings ? 0.15 : 0);
}
