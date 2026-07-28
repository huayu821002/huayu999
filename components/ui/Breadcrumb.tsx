import Link from 'next/link'
import { Icons } from '@/components/ui/Icons'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-joy-gray-500 mb-4" aria-label="Breadcrumb">
      <Link href="/" className="hover:text-joy-orange transition-colors">
        Home
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <Icons.ChevronRight size={14} className="text-joy-gray-300" />
          {item.href ? (
            <Link href={item.href} className="hover:text-joy-orange transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-joy-gray-700 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
