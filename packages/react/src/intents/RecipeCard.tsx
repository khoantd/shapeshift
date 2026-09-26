"use client";

import { Users } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { RecipeData } from "@shapeshift/core/parse/recipe";
import { spring, tween } from "../lib/motion";
import { Chip, Field, Meta, Missing, Placeholder } from "./shared";
import type { CardProps } from "./types";

export function RecipeCard({ data }: CardProps<RecipeData>) {
  const reduce = useReducedMotion();

  return (
    <div className="flex flex-col gap-3">
      <Field index={0} className="flex flex-wrap items-center justify-between gap-3">
        {data.title ? (
          <h2 className="text-[17px] leading-6 font-[550] text-balance">{data.title}</h2>
        ) : (
          <Missing>Untitled recipe</Missing>
        )}
        {data.servings ? (
          <Chip icon={Users}>
            Serves {data.servings}
          </Chip>
        ) : (
          <Placeholder insert=" for 2">Add servings</Placeholder>
        )}
      </Field>
      <Field index={1} className="flex flex-col gap-1">
        <Meta>Ingredients</Meta>
        {data.ingredients.length ? (
          <ul className="flex flex-col">
            {data.ingredients.map((item, i) => (
              <motion.li
                key={item + i}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(3px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={reduce ? tween.fade : { ...spring.settle, delay: 0.03 + i * 0.03 }}
                className="flex min-h-9 items-center gap-2.5 border-b border-border/70 py-1.5 last:border-b-0"
              >
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-foreground/40" />
                <span className="text-[15px] leading-[22px]">{item}</span>
              </motion.li>
            ))}
          </ul>
        ) : (
          <Placeholder insert=" with eggs, flour, milk">Add ingredients</Placeholder>
        )}
      </Field>
    </div>
  );
}
