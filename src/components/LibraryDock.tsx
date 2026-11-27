import * as Dialog from "@radix-ui/react-dialog";
import { BookOpen, ChartNoAxesColumnIncreasing, ChevronRight, LayoutGrid, X, type LucideIcon } from "lucide-react";

interface Activity {
  label: string;
  icon: LucideIcon;
  open: () => void;
}

export function LibraryDock({ activities, onProgress }: { activities: Activity[]; onProgress: () => void }) {
  return (
    <nav className="library-dock" aria-label="Библиотека читателя">
      <a href="#bookshelf" className="dock-current" aria-current="location"><BookOpen aria-hidden="true" />Книги</a>
      <Dialog.Root>
        <Dialog.Trigger asChild><button className="dock-activities"><LayoutGrid aria-hidden="true" />Занятия</button></Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="room-scrim" />
          <Dialog.Content className="room-sheet" aria-describedby={undefined}>
            <div className="sheet-heading">
              <Dialog.Title>Занятия и награды</Dialog.Title>
              <Dialog.Close className="round-control" aria-label="Закрыть"><X size={18} /></Dialog.Close>
            </div>
            <div className="library-activities">{activities.map(({ label, icon: Icon, open }) => (
              <Dialog.Close asChild key={label}><button onClick={open}><Icon size={19} aria-hidden="true" />{label}<ChevronRight size={15} aria-hidden="true" /></button></Dialog.Close>
            ))}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <button onClick={onProgress}><ChartNoAxesColumnIncreasing aria-hidden="true" />Успехи</button>
    </nav>
  );
}
