import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const sans = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

const mono = IBM_Plex_Mono({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CodeCV AI — Recruitment intelligence",
  description:
    "Đánh giá ứng viên bằng bằng chứng: phân tích CV, repository, sinh câu hỏi phỏng vấn và rubric chấm điểm.",
  icons: {
    icon: { url: "/codecvai-app-icon.svg", type: "image/svg+xml" },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef4fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0d0f" },
  ],
};

const themeScript = `(function(){try{var t=localStorage.getItem('codecv-theme');if(t!=='dark'&&t!=='light'){t='light';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      data-theme="light"
      className={`${sans.variable} ${mono.variable}`}
    >
      <body>
        <Script id="codecv-theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
