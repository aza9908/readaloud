/**
 * ProfileAvatar — единая точка отрисовки внешности ребёнка.
 * Поле profile.avatar хранит либо эмодзи, либо "av:<id>" для персонажа,
 * поэтому все места показа проходят через этот компонент.
 */
import { useFamilyReaders } from "@/components/FamilyReaders";
import { avatarById, fromAvatarValue, isAvatarId } from "@/lib/avatars";
import type { Language } from "@/lib/types";
import { companions } from "@/lib/companions";
import { AvatarPortrait } from "@/components/AvatarPortrait";

export function ProfileAvatar({
  value: saved, profileId, size = 40, className = "", language = "ru",
}: { value: string; profileId?: string; size?: number; className?: string; language?: Language }) {
  const value = useFamilyReaders().portrait(profileId, saved);
  if (isAvatarId(value)) {
    const def = avatarById(fromAvatarValue(value));
    if (def) return <AvatarPortrait def={def} size={size} className={className} language={language} />;
  }
  const companion = companions.find(item => item.value === value);
  if (companion) {
    return <img className={`companion-portrait ${className}`} src={companion.image} width={size} height={size} alt={companion.name[language]} />;
  }
  return (
    <span className={className} style={{ fontSize: size * 0.82, lineHeight: 1 }}>
      {value}
    </span>
  );
}
