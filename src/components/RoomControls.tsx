import { useRef, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, X } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export function BackButton({ onClick, label = "Назад" }: { onClick: () => void; label?: string }) {
  return <button type="button" className="round-control" onClick={onClick} aria-label={label} title={label}>
    <ChevronLeft size={21} strokeWidth={2} aria-hidden="true" />
  </button>;
}

export function CloseButton({ onClick, label = "Закрыть" }: { onClick: () => void; label?: string }) {
  return <button type="button" className="round-control sheet-close" onClick={onClick} aria-label={label} title={label}>
    <X size={18} strokeWidth={2} aria-hidden="true" />
  </button>;
}

export function SectionHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return <header className="section-header"><BackButton onClick={onBack} /><h1>{title}</h1><ThemeToggle /></header>;
}

// These sheets are often opened from a menu that has already unmounted.
// Restore focus to the opener when it still exists, or to the library menu.
export function RoomSheet({ title, onClose, children, className = "" }: {
  title: string; onClose: () => void; children: ReactNode; className?: string;
}) {
  const opener = useRef<HTMLElement | null>(null);
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal><Dialog.Overlay className="room-scrim" />
      <Dialog.Content className={`room-sheet content-sheet ${className}`} aria-describedby={undefined}
        onOpenAutoFocus={event => {
          opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          const panel = event.currentTarget;
          if (panel instanceof HTMLElement) { event.preventDefault(); panel.focus(); }
        }}
        onCloseAutoFocus={event => {
          const target = opener.current;
          const restore = target?.isConnected && target !== document.body ? target : document.querySelector<HTMLButtonElement>(".dock-activities");
          if (restore) { event.preventDefault(); restore.focus({ preventScroll: true }); }
        }}>
        <Dialog.Title asChild><span className="sr-only">{title}</span></Dialog.Title>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
