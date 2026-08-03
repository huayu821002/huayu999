'use client'

import { useLocale } from '@/lib/translation/client'
import { SUPPORTED_LOCALES } from '@/lib/translation/translate'

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale()

  return (
    <div className="flex items-center gap-1">
      {SUPPORTED_LOCALES.map((l) => (
        <button
          key={l.code}
          onClick={() => setLocale(l.code as 'en' | 'pt' | 'ru')}
          className={`px-2 py-1 text-xs rounded-md transition-colors ${
            locale === l.code
              ? 'bg-joy-orange text-white'
              : 'text-joy-gray-600 hover:bg-joy-gray-100'
          }`}
          title={l.name}
        >
          {l.flag} {l.code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
