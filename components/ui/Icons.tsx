import * as LucideIcons from 'lucide-react'

// Custom SVG components for missing icons
const TikTokIcon = (props: LucideIcons.LucideProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
  </svg>
)

const WhatsAppIcon = (props: LucideIcons.LucideProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

const TrendUpIcon = (props: LucideIcons.LucideProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
)

const FactoryIcon = (props: LucideIcons.LucideProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
    <path d="M17 18h1"/>
    <path d="M12 18h1"/>
    <path d="M7 18h1"/>
  </svg>
)

const HeadphonesIcon = (props: LucideIcons.LucideProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>
  </svg>
)

export const Icons = {
  Truck: LucideIcons.Truck,
  RefreshCw: LucideIcons.RefreshCw,
  ShieldCheck: LucideIcons.ShieldCheck,
  MessageCircle: LucideIcons.MessageCircle,
  ShoppingCart: LucideIcons.ShoppingCart,
  Menu: LucideIcons.Menu,
  X: LucideIcons.X,
  Search: LucideIcons.Search,
  Heart: LucideIcons.Heart,
  User: LucideIcons.User,
  ChevronDown: LucideIcons.ChevronDown,
  ChevronRight: LucideIcons.ChevronRight,
  ChevronLeft: LucideIcons.ChevronLeft,
  Star: LucideIcons.Star,
  Globe: LucideIcons.Globe,
  Package: LucideIcons.Package,
  Image: LucideIcons.Image,
  Scale: LucideIcons.Scale,
  Zap: LucideIcons.Zap,
  Check: LucideIcons.Check,
  Plus: LucideIcons.Plus,
  Minus: LucideIcons.Minus,
  Trash2: LucideIcons.Trash2,
  Edit3: LucideIcons.Edit3,
  Copy: LucideIcons.Copy,
  ExternalLink: LucideIcons.ExternalLink,
  Instagram: LucideIcons.Instagram,
  Facebook: LucideIcons.Facebook,
  Twitter: LucideIcons.Twitter,
  Youtube: LucideIcons.Youtube,
  TikTok: TikTokIcon,
  WhatsApp: WhatsAppIcon,
  Mail: LucideIcons.Mail,
  Eye: LucideIcons.Eye,
  EyeOff: LucideIcons.EyeOff,
  Filter: LucideIcons.Filter,
  Sliders: LucideIcons.Sliders,
  MapPin: LucideIcons.MapPin,
  Phone: LucideIcons.Phone,
  CreditCard: LucideIcons.CreditCard,
  DollarSign: LucideIcons.DollarSign,
  Lock: LucideIcons.Lock,
  Sparkles: LucideIcons.Sparkles,
  TrendUp: TrendUpIcon,
  Factory: FactoryIcon,
  Headphones: HeadphonesIcon,
  Download: LucideIcons.Download,
  LogOut: LucideIcons.LogOut,
}
