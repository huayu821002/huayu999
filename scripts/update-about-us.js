/**
 * Run this script on Hostinger after deployment to update the About Us page.
 * Usage: node scripts/update-about-us.js
 * 
 * Make sure DATABASE_URL env var is set (it should be in the Node.js environment on Hostinger).
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const aboutUsHTML = `<div style="max-width:900px;margin:0 auto;font-family:Arial,sans-serif;">

<!-- Hero Section -->
<div style="text-align:center;padding:3rem 1rem;background:linear-gradient(135deg,#fff5f0 0%,#fff 100%);border-radius:16px;margin-bottom:3rem;">
  <img src="https://fiestaflare.com/uploads/405b6062-df8e-45d2-a033-96d44f4619c4.png" alt="Fiestaflare" style="width:100%;max-width:600px;border-radius:12px;margin-bottom:2rem;box-shadow:0 8px 32px rgba(0,0,0,0.1);" />
  <h1 style="font-size:2.5rem;font-weight:800;color:#1a1a1a;margin-bottom:1.5rem;line-height:1.2;">Who We Are</h1>
  <p style="font-size:1.15rem;color:#555;line-height:1.9;max-width:720px;margin:0 auto 1rem;"><strong style="color:#f97316;">Fiestaflare</strong> is a B2B wholesale platform headquartered in <strong>Yiwu, Zhejiang, China</strong> — the world's capital of small commodities. We connect global resellers, dropshippers, and small retailers directly with verified manufacturers in Yiwu's vast industrial ecosystem. Whether you're in the USA, Brazil, Russia, or LATAM — Fiestaflare makes sourcing from China simple, affordable, and reliable.</p>
</div>

<!-- Services Grid -->
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.5rem;margin-bottom:3rem;">
  <div style="background:#fff;border-radius:12px;padding:1.5rem;border:1px solid #fee2d5;box-shadow:0 2px 12px rgba(249,115,22,0.08);">
    <div style="font-size:2rem;margin-bottom:0.75rem;">💰</div>
    <h3 style="font-size:1.1rem;font-weight:700;color:#1a1a1a;margin-bottom:0.5rem;">Factory-Direct Pricing</h3>
    <p style="font-size:0.95rem;color:#666;line-height:1.7;margin:0;">We source directly from Yiwu factories, cutting out middlemen to deliver wholesale prices you can profit from.</p>
  </div>
  <div style="background:#fff;border-radius:12px;padding:1.5rem;border:1px solid #fee2d5;box-shadow:0 2px 12px rgba(249,115,22,0.08);">
    <div style="font-size:2rem;margin-bottom:0.75rem;">📦</div>
    <h3 style="font-size:1.1rem;font-weight:700;color:#1a1a1a;margin-bottom:0.5rem;">Low Minimum Order</h3>
    <p style="font-size:0.95rem;color:#666;line-height:1.7;margin:0;">Order from just 3 units per SKU. No massive MOQs blocking your business from launching.</p>
  </div>
  <div style="background:#fff;border-radius:12px;padding:1.5rem;border:1px solid #fee2d5;box-shadow:0 2px 12px rgba(249,115,22,0.08);">
    <div style="font-size:2rem;margin-bottom:0.75rem;">🔍</div>
    <h3 style="font-size:1.1rem;font-weight:700;color:#1a1a1a;margin-bottom:0.5rem;">Quality Inspection</h3>
    <p style="font-size:0.95rem;color:#666;line-height:1.7;margin:0;">Every order is inspected before shipping. We catch problems before they reach your customers.</p>
  </div>
  <div style="background:#fff;border-radius:12px;padding:1.5rem;border:1px solid #fee2d5;box-shadow:0 2px 12px rgba(249,115,22,0.08);">
    <div style="font-size:2rem;margin-bottom:0.75rem;">🚚</div>
    <h3 style="font-size:1.1rem;font-weight:700;color:#1a1a1a;margin-bottom:0.5rem;">Global Shipping</h3>
    <p style="font-size:0.95rem;color:#666;line-height:1.7;margin:0;">Sea and air freight to 150+ countries. US, Brazil, Russia, LATAM — we deliver worldwide.</p>
  </div>
  <div style="background:#fff;border-radius:12px;padding:1.5rem;border:1px solid #fee2d5;box-shadow:0 2px 12px rgba(249,115,22,0.08);">
    <div style="font-size:2rem;margin-bottom:0.75rem;">💬</div>
    <h3 style="font-size:1.1rem;font-weight:700;color:#1a1a1a;margin-bottom:0.5rem;">Bilingual Support</h3>
    <p style="font-size:0.95rem;color:#666;line-height:1.7;margin:0;">Our team speaks English, Portuguese, and Russian to serve you in your language.</p>
  </div>
  <div style="background:#fff;border-radius:12px;padding:1.5rem;border:1px solid #fee2d5;box-shadow:0 2px 12px rgba(249,115,22,0.08);">
    <div style="font-size:2rem;margin-bottom:0.75rem;">🔄</div>
    <h3 style="font-size:1.1rem;font-weight:700;color:#1a1a1a;margin-bottom:0.5rem;">Easy Returns</h3>
    <p style="font-size:0.95rem;color:#666;line-height:1.7;margin:0;">30-day hassle-free return policy for qualifying orders. Your satisfaction is our priority.</p>
  </div>
</div>

<!-- What We Sell -->
<div style="text-align:center;margin-bottom:3rem;">
  <h2 style="font-size:2rem;font-weight:800;color:#1a1a1a;margin-bottom:0.75rem;">What We Sell</h2>
  <p style="font-size:1.05rem;color:#777;margin-bottom:2rem;">Four core categories with strong margins and high demand globally</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1.25rem;">
    <div style="background:linear-gradient(135deg,#fff7ed,#fff);border-radius:12px;padding:1.5rem;border:1px solid #fed7aa;">
      <div style="font-size:2.5rem;margin-bottom:0.75rem;">🎉</div>
      <h3 style="font-size:1rem;font-weight:700;color:#1a1a1a;margin-bottom:0.4rem;">Party Supplies</h3>
      <p style="font-size:0.875rem;color:#666;margin:0;line-height:1.6;">Balloons, banners, tableware, LED decorations</p>
    </div>
    <div style="background:linear-gradient(135deg,#fff7ed,#fff);border-radius:12px;padding:1.5rem;border:1px solid #fed7aa;">
      <div style="font-size:2.5rem;margin-bottom:0.75rem;">🐾</div>
      <h3 style="font-size:1rem;font-weight:700;color:#1a1a1a;margin-bottom:0.4rem;">Pet Supplies</h3>
      <p style="font-size:0.875rem;color:#666;margin:0;line-height:1.6;">Dog toys, cat posts, pet beds, collars</p>
    </div>
    <div style="background:linear-gradient(135deg,#fff7ed,#fff);border-radius:12px;padding:1.5rem;border:1px solid #fed7aa;">
      <div style="font-size:2.5rem;margin-bottom:0.75rem;">💎</div>
      <h3 style="font-size:1rem;font-weight:700;color:#1a1a1a;margin-bottom:0.4rem;">Fashion Accessories</h3>
      <p style="font-size:0.875rem;color:#666;margin:0;line-height:1.6;">Hair clips, earrings, necklaces, sunglasses</p>
    </div>
    <div style="background:linear-gradient(135deg,#fff7ed,#fff);border-radius:12px;padding:1.5rem;border:1px solid #fed7aa;">
      <div style="font-size:2.5rem;margin-bottom:0.75rem;">🏠</div>
      <h3 style="font-size:1rem;font-weight:700;color:#1a1a1a;margin-bottom:0.4rem;">Home Decor</h3>
      <p style="font-size:0.875rem;color:#666;margin:0;line-height:1.6;">Wall art, vases, candles, organizers</p>
    </div>
  </div>
</div>

<!-- Our Promise -->
<div style="background:linear-gradient(135deg,#1a1a1a,#2d2d2d);border-radius:16px;padding:2.5rem;text-align:center;color:#fff;margin-bottom:2rem;">
  <h2 style="font-size:1.75rem;font-weight:800;margin-bottom:1.25rem;color:#fff;">Our Promise</h2>
  <p style="font-size:1.05rem;color:#d1d5db;line-height:1.9;max-width:640px;margin:0 auto 1.5rem;">We started Fiestaflare to solve a real problem: small buyers getting squeezed by big MOQs and opaque pricing. Our team is physically based in Yiwu, visiting factories, negotiating prices, and ensuring every shipment meets our quality bar. We are not just a listing site — we are your <strong style="color:#f97316;">sourcing partner</strong>.</p>
  <p style="font-size:1.15rem;font-weight:600;color:#fff;margin:0;">Welcome to the Fiestaflare community. Let's grow together. 🚀</p>
</div>

</div>`

async function main() {
  const result = await prisma.page.update({
    where: { slug: 'about-us' },
    data: { content: aboutUsHTML },
  })
  console.log('✅ About Us page updated successfully!')
  console.log('Page ID:', result.id)
  console.log('Slug:', result.slug)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
