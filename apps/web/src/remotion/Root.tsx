import React from "react";
import { AbsoluteFill, Composition } from "remotion";
import {
  COMPOSITION_ID,
  FPS,
  HEIGHT,
  TITLE_DURATION_FRAMES,
  WIDTH,
} from "./constants";
import { RepoExplainerVideo } from "./RepoExplainerVideo";
import type { RepoExplainerVideoProps } from "./types";

export {
  COMPOSITION_ID,
  FPS,
  HEIGHT,
  TITLE_DURATION_FRAMES,
  WIDTH,
} from "./constants";

const defaultProps: RepoExplainerVideoProps = {
  fullName: "owner/repo",
  description: "Sample repository",
  titleDurationInFrames: TITLE_DURATION_FRAMES,
  chapters: [
    {
      title: "What it is",
      body: "A short overview of the project.",
      audioSrc: "",
      durationInFrames: 90,
    },
  ],
};

function calcDuration(props: RepoExplainerVideoProps): number {
  const chapters = props.chapters?.length
    ? props.chapters.reduce((sum, c) => sum + (c.durationInFrames || 90), 0)
    : 90;
  return (props.titleDurationInFrames || TITLE_DURATION_FRAMES) + chapters;
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={COMPOSITION_ID}
        component={RepoExplainerVideo}
        durationInFrames={180}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={defaultProps}
        calculateMetadata={({ props }) => ({
          durationInFrames: calcDuration(props),
          fps: FPS,
          width: WIDTH,
          height: HEIGHT,
        })}
      />
      {/* Fallback blank so empty studio still loads */}
      <Composition
        id="Blank"
        component={() => <AbsoluteFill style={{ backgroundColor: "#0f1115" }} />}
        durationInFrames={30}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
