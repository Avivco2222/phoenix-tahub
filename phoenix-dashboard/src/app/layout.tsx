import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { AccessProvider } from "@/context/AccessContext";
import { SessionProvider } from "@/context/SessionContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { DataVersionProvider } from "@/context/DataVersionContext";
import { ToastProvider } from "@/components/Toast";
import SessionGuard from "@/components/SessionGuard";
import { DataVersionToast } from "@/components/DataVersionToast";

// הגדרת הפונט
const heebo = Heebo({ 
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-heebo",
});

export const metadata: Metadata = {
  title: "The FNX TAHub",
  description: "Smart Hiring. People Driven. Automating Success.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      {/* The flex/h-screen/overflow-hidden layout used to live here, but the
          /login page (which AppShell renders bare) needs full-width. AppShell
          re-applies those classes on its dashboard wrapper. */}
      <body className={`${heebo.className} bg-[#F8FAFC]`}>
        {/* Provider stack:
            ToastProvider — toast UI
            SessionProvider — real auth (cookie + bcrypt + backend)
            AccessProvider — legacy shim that maps SessionContext → useAccess() shape
            NotificationProvider — in-app notification polling
            SessionGuard — session-lock screen handler
            AppShell — sidebar/header chrome */}
        <ToastProvider>
          <SessionProvider>
            <AccessProvider>
              <NotificationProvider>
                <DataVersionProvider>
                  <SessionGuard />
                  <DataVersionToast />
                  <AppShell>{children}</AppShell>
                </DataVersionProvider>
              </NotificationProvider>
            </AccessProvider>
          </SessionProvider>
        </ToastProvider>
      </body>
    </html>
  );
}