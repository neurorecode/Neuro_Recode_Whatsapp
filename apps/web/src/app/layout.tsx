import './globals.css';
import type { Metadata } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Neuro Recode — WhatsApp Inbox',
  description: 'Custom agent inbox on the WhatsApp Business Cloud API',
};

// Applies the saved (or system) theme before first paint to avoid a flash.
const themeInit = `(function(){try{var t=localStorage.getItem('nrw-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
