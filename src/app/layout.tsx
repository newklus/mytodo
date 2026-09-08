import type { Metadata } from "next";
import ShortcutBar from "@/components/ShortcutBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyTodo",
  description: "회사 업무 관리용 TODO 앱",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full flex flex-col overflow-hidden">
        {children}
        <ShortcutBar />
      </body>
    </html>
  );
}
