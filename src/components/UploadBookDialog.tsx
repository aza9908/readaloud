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

  const wordCount = useMemo(() => countWords(text), [text]);
  const estimatedPages = Math.max(1, Math.ceil(wordCount / 45));
  const valid =
    title.trim().length > 0 &&
    wordCount >= MIN_TOTAL_WORDS &&
    wordCount <= MAX_TOTAL_WORDS;

  if (!open) return null;

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".txt")) {
      toast({ icon: "⚠️", title: "Только .txt файлы", description: "Скопируйте текст и вставьте его в поле ниже." });
      return;
    }
    const content = await file.text();
    setText(content);
    if (!title.trim()) setTitle(file.name.replace(/\.txt$/i, ""));
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
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-800 p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              📚 Добавить свою книгу
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Вставьте текст — страницы соберутся сами.
            </p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-slate-400 hover:text-slate-600 p-1" aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="cb-title">
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
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Язык книги</span>
          <div className="flex gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLanguage(l.value)}
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  language === l.value
                    ? "bg-primary text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200"
                }`}
              >
                {l.flag} {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Обложка</span>
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setCoverEmoji(e)}
                className={`text-2xl w-10 h-10 rounded-xl transition-colors ${
                  coverEmoji === e
                    ? "bg-primary-soft ring-2 ring-primary dark:bg-primary/20"
                    : "hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
                aria-label={`Обложка ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="cb-text">
              Текст книги
            </label>
            <button
              type="button"
              className="text-sm font-semibold text-primary hover:underline"
              onClick={() => fileInputRef.current?.click()}
            >
              📄 Загрузить .txt
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
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
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {wordCount} слов · ≈{estimatedPages} стр.
            {wordCount > 0 && wordCount < MIN_TOTAL_WORDS && ` · минимум ${MIN_TOTAL_WORDS} слов`}
            {wordCount > MAX_TOTAL_WORDS && ` · максимум ${MAX_TOTAL_WORDS} слов`}
          </p>
        </div>

        <button className="btn-primary w-full" disabled={!valid || saving} onClick={() => void submit()}>
          {saving ? "Сохраняем…" : "⬆️ Добавить в библиотеку"}
        </button>
      </div>
    </div>
  );
}
