'use client'

import { LocaleProvider } from '@/lib/translation/client'

export function Providers({ children }: { children: React.ReactNode }) {
  return <LocaleProvider>{children}</LocaleProvider>
}
