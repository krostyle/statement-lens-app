import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { esES } from '@clerk/localizations';
import './globals.css';

// esES from @clerk/localizations leaves some placeholders in English.
// We deep-merge our overrides on top of the base locale.
const clerkLocalization = {
  ...esES,
  signUp: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(esES as any).signUp,
    start: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(esES as any).signUp?.start,
      formFieldInputPlaceholder__password: 'Crea una contraseña',
      formFieldInputPlaceholder__confirmPassword: 'Confirma tu contraseña',
    },
  },
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Statement Lens',
  description: 'Gestión de finanzas personales basada en estados de cuenta',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider localization={clerkLocalization}>
      <html lang="es">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
