import { Composition } from "remotion";
import { COMPOSITION_ID, VIDEO_HEIGHT, VIDEO_WIDTH, type YuruAnimeProps } from "./props";
import { buildSampleProps } from "./sample";
import { YuruAnimeV1 } from "./YuruAnimeV1";

const sample = buildSampleProps({ showSafeZone: true });

export const RemotionRoot: React.FC = () => (
  <Composition
    id={COMPOSITION_ID}
    component={YuruAnimeV1}
    width={VIDEO_WIDTH}
    height={VIDEO_HEIGHT}
    fps={30}
    durationInFrames={sample.timing.totalFrames}
    defaultProps={sample.props}
    calculateMetadata={({ props }: { props: YuruAnimeProps }) => ({
      durationInFrames: props.sceneFrames.reduce((a, b) => a + b, 0),
      fps: props.plan.fps,
    })}
  />
);
