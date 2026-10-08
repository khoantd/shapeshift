/** Input props for RepoExplainer — no remotion imports (safe for Next API routes). */
export type VideoChapterProps = {
  title: string;
  body: string;
  audioSrc: string;
  durationInFrames: number;
};

export type RepoExplainerVideoProps = {
  fullName: string;
  description: string | null;
  chapters: VideoChapterProps[];
  titleDurationInFrames: number;
};
