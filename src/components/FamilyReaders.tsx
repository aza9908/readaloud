import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { companions } from "@/lib/companions";
import { watchProfiles } from "@/lib/firestore";
import type { ChildProfile } from "@/lib/types";

function arrangePortraits(profiles: ChildProfile[] | null) {
  const portraits = new Map<string, string>();
  const uses = new Map(companions.map(pet => [pet.value, 0]));
  const ordered = [...(profiles ?? [])].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  function leastUsed() {
    return companions.reduce((best, pet) => uses.get(pet.value)! < uses.get(best.value)! ? pet : best).value;
  }
  // Reserve each child's distinct choice before giving siblings their own animals.
  for (const { id, avatar } of ordered) {
    if (avatar?.startsWith("av:")) portraits.set(id, avatar);
    else if (uses.get(avatar) === 0) {
      portraits.set(id, avatar);
      uses.set(avatar, 1);
    }
  }
  for (const { id } of ordered) {
    if (portraits.has(id)) continue;
    const animal = leastUsed();
    portraits.set(id, animal);
    uses.set(animal, uses.get(animal)! + 1);
  }
  return {
    profiles,
    suggested: leastUsed(),
    portrait(id: string | undefined, saved: string) {
      return id && profiles?.some(p => p.id === id && p.avatar === saved) ? portraits.get(id) ?? saved : saved;
    },
    otherAnimals(id?: string) {
      const taken = new Set([...portraits].filter(([key]) => key !== id).map(([, animal]) => animal));
      return companions.every(pet => taken.has(pet.value)) ? new Set<string>() : taken;
    },
  };
}

const Family = createContext(arrangePortraits(null));
export function FamilyReaders({ uid, children }: { uid: string; children: ReactNode }) {
  const [profiles, setProfiles] = useState<ChildProfile[] | null>(null);
  useEffect(() => watchProfiles(uid, setProfiles), [uid]);
  const family = useMemo(() => arrangePortraits(profiles), [profiles]);
  return <Family.Provider value={family}>{children}</Family.Provider>;
}
export function useFamilyReaders() {
  return useContext(Family);
}
