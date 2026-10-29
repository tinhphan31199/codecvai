"use client";

import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  BlockQuote,
  Bold,
  ClassicEditor,
  Essentials,
  Italic,
  Link,
  List,
  Paragraph,
  Underline,
} from "ckeditor5";
import vi from "ckeditor5/translations/vi.js";
import type { Lang } from "@/lib/i18n";
import "ckeditor5/ckeditor5.css";

type CkEditorProps = {
  value: string;
  lang: Lang;
  onChange: (html: string) => void;
};

export default function CkEditor({ value, lang, onChange }: CkEditorProps) {
  return (
    <CKEditor
      editor={ClassicEditor}
      data={value}
      config={{
        licenseKey: "GPL",
        language: lang,
        translations: lang === "vi" ? [vi] : [],
        plugins: [
          Essentials,
          Paragraph,
          Bold,
          Italic,
          Underline,
          List,
          Link,
          BlockQuote,
        ],
        toolbar: [
          "undo",
          "redo",
          "|",
          "bold",
          "italic",
          "underline",
          "|",
          "bulletedList",
          "numberedList",
          "|",
          "link",
          "blockquote",
        ],
      }}
      onChange={(_event, editor) => onChange(editor.getData())}
    />
  );
}
