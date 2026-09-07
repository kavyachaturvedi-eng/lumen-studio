import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lumen Studio — AI product photography",
  description: "Upload one plain product photo. Get packshots, ghost mannequin, flat lays, lifestyle and hero shots that keep your label and finish.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900">{children}</body>
    </html>
  );
}
