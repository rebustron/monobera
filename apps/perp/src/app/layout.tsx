import "../styles/globals.css";
import { IBM_Plex_Sans } from "next/font/google";
import Script from "next/script";
import { perpsName, perpsUrl } from "@bera/config";
import {
  Header,
  MainWithBanners,
  TailwindIndicator,
  TermOfUseModal,
} from "@bera/shared-ui";
import { cn } from "@bera/ui";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "react-hot-toast";

import Providers from "./Providers";
import { navItems } from "./config";
import { Metadata } from "next";

const fontSans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(perpsUrl),
};

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <Script
        id="HotJarAnalytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `(function(h,o,t,j,a,r){
            h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
            h._hjSettings={hjid:3728321,hjsv:6};
            a=o.getElementsByTagName('head')[0];
            r=o.createElement('script');r.async=1;
            r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
            a.appendChild(r);
        })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`,
        }}
      />
      <body
        className={cn("bg-background font-sans antialiased", fontSans.variable)}
      >
        <TermOfUseModal />
        <Providers>
          <div className="z-[100]">
            <Toaster position="bottom-right" />
          </div>
          <div className="relative flex min-h-screen w-full flex-col overflow-hidden">
            <Header navItems={navItems} appName={perpsName} />
            <MainWithBanners appName={perpsName}>
              {props.children}
            </MainWithBanners>
            <Toaster position="bottom-right" />
          </div>
          <TailwindIndicator />
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
