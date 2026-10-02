import type { Metadata } from "next";
import { Inter, Archivo_Black } from "next/font/google";
import { CartProvider } from "@/components/cart";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { site } from "@/lib/site";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const display = Archivo_Black({ variable: "--font-archivo", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: `${site.name} | Custom Printing in Houston, TX`, template: `%s | ${site.name}` },
  description:
    "Custom apparel, hats, stickers, yard signs and trade show displays. Printed in Houston, TX by Maxx Marketing Agency.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable} h-full antialiased`}>
      {/* Browser extensions (e.g. ColorZilla) add attributes to <body> before React loads */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <CartProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
