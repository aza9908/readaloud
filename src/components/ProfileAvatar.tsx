/**
 * ProfileAvatar — единая точка отрисовки внешности ребёнка.
 * Поле profile.avatar хранит либо эмодзи, либо "av:<id>" для персонажа,
 * поэтому все места показа проходят через этот компонент.
 */
import { avatarById, fromAvatarValue, isAvatarId } from "@/lib/avatars";
import { AvatarPortrait } from "@/components/AvatarPortrait";

export function ProfileAvatar({
  value, size = 40, className = "",
}: { value: string; size?: number; className?: string }) {
  if (isAvatarId(value)) {
    const def = avatarById(fromAvatarValue(value));
    if (def) return <AvatarPortrait def={def} size={size} className={className} />;
  }
  return (
    <span className={className} style={{ fontSize: size * 0.82, lineHeight: 1 }}>
      {value}
    </span>
  );
}
