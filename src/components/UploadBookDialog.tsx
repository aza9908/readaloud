import { BookserIcon, iconLabel } from "@/components/BookserIcon";
import { RoomSheet, CloseButton } from "@/components/RoomControls";
/** UploadBookDialog — parents add a book from pasted text or a .txt file.
 *  Pagination runs client-side (paginateText); Firestore rules validate. */

import { useMemo, useRef, useState } from "react";
import {
  countWords,
  createCustomBook,
  MAX_TOTAL_WORDS,
  MIN_TOTAL_WORDS,
} from "@/lib/firestore";
import { LANGUAGES, type Language } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { importFile, ACCEPTED_FILE_TYPES } from "@/lib/fileImport";

const EMOJI_CHOICES = ["📖", "🦊", "🐻", "🚀", "🌟", "🐉", "🏰", "🌊", "🦁", "🎨"];

interface Props {
  uid: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function UploadBookDialog({ uid, open, onClose, onCreated }: Props) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<Language>("ru");
  const [text, setText] = useState("");
  const [coverEmoji, setCoverEmoji] = useState("📖");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const wordCount = useMemo(() => countWords(text), [text]);
  const estimatedPages = Math.max(1, Math.ceil(wordCount / 45));
  const valid =
    title.trim().length > 0 &&
    wordCount >= MIN_TOTAL_WORDS &&
    wordCount <= MAX_TOTAL_WORDS;

  if (!open) return null;

  const handleFile = async (file: File) => {
    setImporting(true);
    try {
      const result = await importFile(file);
      if (!result.text.trim()) {
        toast({
          icon: "⚠️",
          title: "Не удалось прочитать файл",
          description: "Возможно, это скан без текстового слоя. Скопируйте текст вручную.",
        });
        return;
      }
      setText(result.text);
      if (!title.trim()) setTitle(result.suggestedTitle.slice(0, 120));
      toast({
        icon: "📄",
        title: "Файл прочитан",
        description: result.pageCount
          ? `${result.pageCount} стр. в PDF · ${countWords(result.text)} слов`
          : `${countWords(result.text)} слов`,
      });
    } catch (err) {
      toast({
        icon: "⚠️",
        title: err instanceof Error && err.message === "UNSUPPORTED"
          ? "Формат не поддерживается"
          : "Не удалось прочитать файл",
        description: "Поддерживаются PDF, EPUB и TXT.",
      });
    } finally {
      setImporting(false);
    }
  };

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const { pageCount } = await createCustomBook(uid, {
        title,
        language,
        text,
        coverEmoji,
      });
      toast({
        icon: "🎉",
        title: "Книга добавлена!",
        description: `«${title.trim()}» — ${pageCount} стр., ${wordCount} слов`,
      });
      setTitle("");
      setText("");
      setCoverEmoji("📖");
      onCreated();
      onClose();
    } catch (err) {
      toast({
        icon: "❌",
        title: "Не удалось добавить книгу",
        description: err instanceof Error ? err.message : "Попробуйте ещё раз",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoomSheet returnFocus=".add-book" title="Добавить свою книгу" onClose={onClose} className="space-y-4 upload-sheet">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-display font-extrabold text-ink dark:text-white">
              Добавить свою книгу
            </h2>
            <p className="text-sm text-ink-faint dark:text-ink-faint">
              Вставьте текст или загрузите PDF / EPUB / TXT — страницы соберутся сами.
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-ink-soft dark:text-ink-faint" htmlFor="cb-title">
            Название
          </label>
          <input
            id="cb-title"
            className="input"
            placeholder="Например: Золотая рыбка"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-semibold text-ink-soft dark:text-ink-faint">Язык книги</span>
          <div className="flex gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                type="button"
                aria-pressed={language === l.value} onClick={() => setLanguage(l.value)}
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  language === l.value
                    ? "bg-brand-500 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-ink-soft dark:text-ink-faint hover:bg-slate-200"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-semibold text-ink-soft dark:text-ink-faint">Обложка</span>
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setCoverEmoji(e)}
                className={`text-2xl w-10 h-10 rounded-xl transition-colors ${
                  coverEmoji === e
                    ? "bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-500/20"
                    : "hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
                aria-label={iconLabel(e)} aria-pressed={coverEmoji === e}
              >
                <BookserIcon value={e} size={31} />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-ink-soft dark:text-ink-faint" htmlFor="cb-text">
              Текст книги
            </label>
            <button
              type="button"
              className="text-sm font-semibold text-brand-500 hover:underline"
              onClick={() => fileInputRef.current?.click()}
            >
              <BookserIcon value="📄" size={16} line /> Загрузить файл
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
          </div>
          <textarea
            id="cb-text"
            className="input min-h-[10rem] resize-y"
            placeholder={"Жили-были дед да баба…\n\nРазделяйте абзацы пустой строкой — так страницы получатся красивее."}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-xs text-ink-faint dark:text-ink-faint">
            {wordCount} слов · ≈{estimatedPages} стр.
            {wordCount > 0 && wordCount < MIN_TOTAL_WORDS && ` · минимум ${MIN_TOTAL_WORDS} слов`}
            {wordCount > MAX_TOTAL_WORDS && ` · максимум ${MAX_TOTAL_WORDS} слов`}
          </p>
        </div>

        <button className="btn-primary w-full" disabled={!valid || saving} onClick={() => void submit()}>
          {saving ? "Сохраняем…" : <><BookserIcon value="⬆" size={17} line /> Добавить в библиотеку</>}
        </button>
    </RoomSheet>
  );
}
