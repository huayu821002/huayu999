'use client'

import Script from 'next/script'

export function TidioChat() {
  const publicKey = process.env.NEXT_PUBLIC_TIDIO_KEY

  if (!publicKey) {
    return null
  }

  return (
    <Script
      src={`//code.tidio.co/${publicKey}.js`}
      strategy="afterInteractive"
      async
    />
  )
}
