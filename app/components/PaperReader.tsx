'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The technical report as a book: one image per page, turned by dragging a corner,
 * clicking, the arrow buttons or the keyboard. On a narrow screen it shows one page at
 * a time. The PDF is always one click away for anyone who would rather read it there.
 */
export function PaperReader({ pages, pdf }: { pages: string[]; pdf: string }) {
  const host = useRef<HTMLDivElement>(null);
  const book = useRef<import('page-flip/dist/js/page-flip.module.js').PageFlip | null>(null);
  const [page, setPage] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { PageFlip } = await import('page-flip/dist/js/page-flip.module.js');
      if (cancelled || !host.current) return;
      const flip = new PageFlip(host.current, {
        width: 612,
        height: 792,
        size: 'stretch',
        minWidth: 260,
        maxWidth: 820,
        minHeight: 336,
        maxHeight: 1060,
        showCover: false,
        usePortrait: true,
        drawShadow: true,
        maxShadowOpacity: 0.35,
        flippingTime: 700,
        mobileScrollSupport: true,
        showPageCorners: true,
        autoSize: true,
      });
      // HTML mode rather than canvas: real images stay sharp at any zoom, can be read by
      // assistive technology, and do not depend on an animation loop to appear. The
      // page elements are created here, outside React, because the library moves them.
      const nodes = pages.map((src, i) => {
        const pageEl = document.createElement('div');
        pageEl.className = 'reader-page';
        if (i === 0 || i === pages.length - 1) pageEl.dataset.density = 'hard';
        const img = document.createElement('img');
        img.src = src;
        img.alt = `Technical report, page ${i + 1} of ${pages.length}`;
        img.draggable = false;
        pageEl.appendChild(img);
        host.current!.appendChild(pageEl);
        return pageEl;
      });
      flip.loadFromHTML(nodes);
      flip.on('flip', (e) => setPage(Number(e.data)));
      flip.on('init', () => setReady(true));
      book.current = flip;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      book.current?.destroy();
      book.current = null;
    };
  }, [pages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!book.current) return;
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea/i.test(target.tagName)) return;
      if (e.key === 'ArrowRight') book.current.flipNext();
      if (e.key === 'ArrowLeft') book.current.flipPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="reader">
      <div className="reader-stage">
        {!ready && <p className="reader-loading">Opening the report…</p>}
        <div ref={host} className="reader-book" />
      </div>
      <div className="reader-bar">
        <button
          type="button"
          className="btn-circle"
          aria-label="Previous page"
          onClick={() => book.current?.flipPrev()}
          disabled={page === 0}
        >
          ←
        </button>
        <span className="reader-count" aria-live="polite">
          Page {page + 1} of {pages.length}
        </span>
        <button
          type="button"
          className="btn-circle"
          aria-label="Next page"
          onClick={() => book.current?.flipNext()}
          disabled={page >= pages.length - 1}
        >
          →
        </button>
        <a className="btn ghost" href={pdf} download>
          Download PDF
        </a>
      </div>
    </div>
  );
}
