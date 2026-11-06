"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

const MM_TO_PX = 96 / 25.4;
const A4_WIDTH = 210 * MM_TO_PX;
const A4_HEIGHT = 297 * MM_TO_PX;

interface CVPreviewProps {
  html: string;
  title: string;
  frameRef: RefObject<HTMLIFrameElement | null>;
}

export default function CVPreview({ html, title, frameRef }: CVPreviewProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [docHeight, setDocHeight] = useState(A4_HEIGHT);

  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? node.clientWidth;
      setScale(Math.min(1, width / A4_WIDTH));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="cv-preview"
      ref={boxRef}
      style={{ height: Math.round(docHeight * scale) }}
    >
      <iframe
        ref={frameRef}
        title={title}
        srcDoc={html}
        onLoad={(event) => {
          const doc = event.currentTarget.contentDocument;
          if (!doc) return;
          setDocHeight(
            Math.max(
              A4_HEIGHT,
              doc.documentElement.scrollHeight,
              doc.body?.scrollHeight ?? 0,
            ),
          );
        }}
        style={{
          width: A4_WIDTH,
          height: docHeight,
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
}
