'use client'

import { StickySearchBar } from '@/components/home/StickySearchBar'

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StickySearchBar />
      {children}
    </>
  )
}
