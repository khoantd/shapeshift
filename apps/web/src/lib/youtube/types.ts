import { z } from "zod";

export const youtubeVideoIdSchema = z
  .string()
  .trim()
  .regex(/^[\w-]{11}$/, "Invalid YouTube video id");

export const youtubeSearchQuerySchema = z.string().trim().min(2).max(200);

const httpsUrlSchema = z
  .string()
  .url()
  .refine((u) => u.startsWith("https://"), { message: "Must be https" });

export const youtubeVideoSchema = z.object({
  videoId: youtubeVideoIdSchema,
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  channelTitle: z.string().max(200).optional(),
  publishedAt: z.string().max(40).optional(),
  thumbnailUrl: httpsUrlSchema.optional(),
  duration: z.string().max(40).optional(),
  viewCount: z.string().max(40).optional(),
});

export type YouTubeVideo = z.infer<typeof youtubeVideoSchema>;

export function parseSearchQuery(q: string | null): string | null {
  const parsed = youtubeSearchQuerySchema.safeParse(q ?? "");
  return parsed.success ? parsed.data : null;
}

export function parseVideoIdParam(id: string | null): string | null {
  const parsed = youtubeVideoIdSchema.safeParse(id ?? "");
  return parsed.success ? parsed.data : null;
}
