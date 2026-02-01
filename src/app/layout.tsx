// src/app/layout.tsx
import { Providers } from "./providers";
import { ClientLayout } from "@/components/layout/ClientLayout";

export const metadata = {
  title: 'TEASY CRM',
  description: 'CRM for TEASY',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Providers>
          <ClientLayout>
            {children}
          </ClientLayout>
        </Providers>
      </body>
    </html>
  );
}
