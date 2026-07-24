# JoyHub Wholesale - B2B E-Commerce Platform

A full-featured B2B wholesale e-commerce platform built with Next.js 14, Tailwind CSS, Prisma, and Zustand. Designed for the North and South American markets with bilingual support, multi-currency pricing, and mobile-first design.

## 🎯 Key Features

### Market Focus
- **North America**: Clean minimalist design, safety & compliance focus, FDA-approved pet products
- **South America**: Vibrant colors, mobile-first, WhatsApp integration, TikTok sharing

### Core E-Commerce
- [x] Multi-currency support (USD, MXN, BRL)
- [x] Three-tier pricing (Retail, Wholesale, VIP)
- [x] IP-based timezone currency detection
- [x] $50 minimum mixed order
- [x] Free shipping thresholds (NA: $299+, SA: $499+)
- [x] 15-20 day shipping promise with progress bar

### Product Features
- [x] Scene-based collections (Trending, Pet & Me, Dorm Decor)
- [x] Hover image swap (model/尺寸图)
- [x] Tier price display on product cards
- [x] Quick add to cart
- [x] Wishlist functionality
- [x] Low stock indicators
- [x] Compliance badges (FDA, CE)

### User Experience
- [x] Mobile-first responsive design
- [x] Floating WhatsApp button
- [x] Floating TikTok share button
- [x] 10-second subscribe modal
- [x] Trust badges (24h Shipping, Easy Return, FDA Approved, Español Support)
- [x] Cart drawer with mini preview

### Admin Dashboard
- [x] Dashboard with key metrics
- [x] Order management
- [x] Product management
- [x] Customer management
- [x] Settings configuration

## 🚀 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS 3.4
- **Database**: PostgreSQL with Prisma ORM
- **State Management**: Zustand with persist middleware
- **Payments**: Stripe (ready for integration)
- **Icons**: Lucide React
- **Fonts**: Inter + Poppins (Google Fonts)

## 📁 Project Structure

```
joyhub-wholesale/
├── app/
│   ├── (shop)/          # Customer-facing pages
│   │   ├── products/
│   │   ├── cart/
│   │   ├── checkout/
│   │   ├── account/
│   │   └── login/
│   ├── (admin)/          # Admin dashboard
│   │   ├── dashboard/
│   │   ├── products/
│   │   ├── orders/
│   │   └── settings/
│   └── api/              # API routes
├── components/
│   ├── ui/               # Base UI components
│   ├── shop/             # Shop-specific components
│   ├── admin/            # Admin components
│   └── layout/           # Header, Footer, etc.
├── lib/
│   ├── store/            # Zustand stores
│   └── utils/            # Utility functions
├── prisma/
│   └── schema.prisma     # Database schema
└── types/                # TypeScript types
```

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or pnpm

### Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd joyhub-wholesale
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## 📱 Design System

### Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Joy Orange | #FF6B35 | Primary CTA, South American accent |
| Joy Pink | #E91E8C | Secondary accent, highlights |
| Joy Green | #1B5E20 | Success states, FDA badge |
| Joy Navy | #1A237E | North American accent |
| Joy Gray | #9E9E9E | Neutral text, borders |

### Typography

- **Display**: Poppins (headings)
- **Body**: Inter (paragraphs)

## 🔌 API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/products` | GET | List products |
| `/api/products/[slug]` | GET | Get product |
| `/api/cart` | GET/POST | Cart operations |
| `/api/orders` | GET/POST | Order management |
| `/api/auth/[...nextauth]` | * | Authentication |

## 📊 Database Schema

### Key Models

- **User**: Customer/Admin accounts
- **Product**: Items with pricing tiers
- **Order**: Orders with status tracking
- **Category**: Product categories
- **Cart**: Shopping cart with items

## 🎨 Customization

### Changing Colors

Edit `tailwind.config.ts`:

```typescript
colors: {
  'joy-orange': '#FF6B35',
  'joy-pink': '#E91E8C',
  'joy-green': '#1B5E20',
}
```

### Adding Products

Use the admin dashboard or seed the database:

```bash
npx prisma db seed
```

## 🚢 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect to Vercel
3. Set environment variables
4. Deploy

### Docker

```bash
docker build -t joyhub-wholesale .
docker run -p 3000:3000 --env-file .env joyhub-wholesale
```

## 📄 License

Private - All rights reserved.

## 🤝 Support

- Documentation: `/docs`
- Issues: GitHub Issues
- Email: hello@joyhubwholesale.com

---

Built with ❤️ for the cross-border B2B wholesale market.
# Deployment trigger
