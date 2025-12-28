import type { Metadata } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-atkinson",
});

export const metadata: Metadata = {
  title: "Pollis - End-to-End Encrypted Messaging",
  description: "Secure, private communication for teams and individuals. Your messages, your keys, your privacy.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${atkinson.variable} font-sans antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
