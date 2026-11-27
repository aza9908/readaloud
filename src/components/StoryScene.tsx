import { memo, useState } from "react";
import type { StoryArt } from "@/lib/storyArt";

export const StoryScene = memo(function StoryScene({ src, art }: { src?: string | null; art: StoryArt }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const original = src && src !== failedUrl ? src : undefined;
  return (
    <figure className="story-bookplate reader-illustration" data-kind={original ? "photo" : art.kind} data-art={original ? "original" : art.id}>
      <img width={840} height={560} lang={original ? undefined : art.language} alt={original ? "" : art.alt} decoding="async" referrerPolicy="no-referrer"
        src={original || art.page}
        srcSet={!original && art.kind === "scene" ? `${art.cover} 360w, ${art.page} 840w` : undefined}
        sizes="(min-width: 58rem) 400px, (min-width: 45rem) 680px, 100vw"
        onError={original ? () => setFailedUrl(original) : undefined} />
    </figure>
  );
});
