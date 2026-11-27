import { useState } from "react";
import { storyArt } from "@/lib/storyArt";
import type { Book } from "@/lib/types";
import { BookserIcon } from "./BookserIcon";

export function BookJacket({ book }: { book: Book }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const plate = storyArt(book.language, book.title);
  const photo = book.coverUrl && book.coverUrl !== failedUrl ? book.coverUrl : undefined;
  return <span className="book-jacket" data-cloth={(book.title.charCodeAt(0) || 0) % 5} aria-hidden="true">
    {photo ? <img src={photo} className="jacket-photo" alt="" loading="lazy" onError={() => setFailedUrl(photo)} />
      : plate ? <img className="jacket-plate" src={plate.cover} alt="" width={192} height={128} loading="lazy" />
      : <BookserIcon value={book.coverEmoji} size={46} />}
  </span>;
}
