import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EVergy",
  description: "EVergy energy manager",
  icons: {
    icon: "/icon-512.png",
    apple: "/apple-touch-icon-180.png",
  },
  appleWebApp: {
    capable: true,
    title: "EVergy",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
