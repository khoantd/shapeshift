"use client";

import { mockClassifyAsync } from "@shapeshift/core";
import { createFetchClassify, Shapeshift, type ClassifyFn } from "@shapeshift/react";
import { useMemo } from "react";
import { recordIntentResult } from "@/lib/intentStats";

const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true";

function withIntentRecording(classify: ClassifyFn): ClassifyFn {
  return async (text, signal) => {
    const result = await classify(text, signal);
    if (!signal.aborted && !result.error) {
      recordIntentResult(result, text.length);
    }
    return result;
  };
}

export function ShapeshiftApp() {
  const classify = useMemo(() => {
    const base: ClassifyFn = useMock
      ? mockClassifyAsync
      : createFetchClassify("/api/intent");
    return withIntentRecording(base);
  }, []);
  return <Shapeshift classify={classify} />;
}
