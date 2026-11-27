import { useState } from "react";
import { jacketArt, type JacketBook } from "@/lib/storyArt";

export function BookJacket({ book, sizes = "80px" }: { book: JacketBook; sizes?: string }) {
  const [broken, setBroken] = useState<string[]>([]);
  const art = jacketArt(book);
  const photo = [book.coverUrl, ...(book.pageImages ?? [])].find(url => url && !broken.includes(url));
  return (
    <span className="book-jacket" aria-hidden="true" data-art={photo ? "original" : art.id} data-kind={photo ? "photo" : art.kind}>
      <img className="jacket-picture" alt="" width={360} height={240} loading="lazy" decoding="async"
        referrerPolicy="no-referrer" src={photo || art.cover}
        srcSet={!photo && art.kind === "scene" ? `${art.cover} 360w, ${art.page} 840w` : undefined}
        sizes={sizes}
        onError={photo ? () => setBroken(previous => [...previous, photo]) : undefined} />
    </span>
  );
}

export function JacketPreview({ books }: { books: JacketBook[] }) {
  return <div className="jacket-preview" aria-hidden="true">
    {books.slice(0, 3).map((book, i) => <BookJacket book={book} key={i + book.title} sizes="90px" />)}
  </div>;
}
