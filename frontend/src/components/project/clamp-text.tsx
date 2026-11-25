"use client";

import { useLayoutEffect, useRef, useState } from "react";

const LINES = 5;

/** Story text cut at five lines; "More" shows the rest, only when there is more to show. */
export function ClampText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || open) return;
    const measure = () => setCut(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, text]);

  return (
    <>
      <p
        ref={ref}
        className="whitespace-pre-line text-body text-ink-2"
        style={open ? undefined : { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: LINES, overflow: "hidden" }}
      >
        {text}
      </p>
      {(cut || open) && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="tap relative self-start text-cap font-semibold text-primary-strong outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {open ? "Less" : "More"}
        </button>
      )}
    </>
  );
}
