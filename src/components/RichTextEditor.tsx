"use client";

import dynamic from "next/dynamic";
import { useLang, useT } from "@/lib/i18n";

const CkEditor = dynamic(() => import("./CkEditor"), {
  ssr: false,
  loading: () => <EditorLoading />,
});

function EditorLoading() {
  const t = useT();
  return <div className="rich-editor-loading">{t("editor.loading")}</div>;
}

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
};

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const lang = useLang();
  return (
    <div className="rich-editor">
      <CkEditor key={lang} lang={lang} value={value} onChange={onChange} />
    </div>
  );
}
