import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getSessionUser } from '@/lib/auth';
import { FloatingHeader } from '@/components/ui/floating-header';
import AppContainer from '@/components/ui/app-container';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Trucking Invoice Generator",
  description: "Multi-Company Driver Settlement",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();

  return (
    <html lang="en">
      <body className={`${inter.className} bg-zinc-950 min-h-screen text-gray-100`}>
        {user && (
          <div className="pt-4">
            <AppContainer>
              <FloatingHeader userEmail={user.email} />
            </AppContainer>
          </div>
        )}
        <main className={user ? "py-6" : ""}>
          <AppContainer>
            {children}
          </AppContainer>
        </main>
      </body>
    </html>
  );
}
