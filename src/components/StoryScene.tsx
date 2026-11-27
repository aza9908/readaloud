import { memo } from "react";
import { BookserIcon } from "./BookserIcon";

export const StoryScene = memo(function StoryScene({ title, emoji, className = "", dark = false }: {
  title: string; emoji: string; className?: string; dark?: boolean;
}) {
  return <div className={`story-frontispiece ${className}`} data-night={dark} role="img" aria-label={title}>
    <div className="frontispiece-frame"><BookserIcon value={emoji} size={92} /></div>
  </div>;
});
