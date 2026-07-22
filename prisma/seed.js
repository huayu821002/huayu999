const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'accessories' },
      update: {},
      create: {
        name: 'Accessories',
        slug: 'accessories',
        description: 'Fashion accessories including jewelry, necklaces, bracelets',
      },
    }),
    prisma.category.upsert({
      where: { slug: 'pet-supplies' },
      update: {},
      create: {
        name: 'Pet Supplies',
        slug: 'pet-supplies',
        description: 'Pet toys, collars, carriers, and accessories',
      },
    }),
    prisma.category.upsert({
      where: { slug: 'gifts' },
      update: {},
      create: {
        name: 'Creative Gifts',
        slug: 'gifts',
        description: 'Unique and creative gift ideas',
      },
    }),
    prisma.category.upsert({
      where: { slug: 'home-decor' },
      update: {},
      create: {
        name: 'Home Décor',
        slug: 'home-decor',
        description: 'Nordic and Ins-style home decorations',
      },
    }),
  ])

  console.log('✅ Categories created')

  const [accessories, petSupplies, gifts, homeDecor] = categories

  // Create products
  const products = [
    {
      name: 'Yiwu Crystal Beaded Statement Necklace',
      slug: 'yiwu-crystal-beaded-necklace',
      description: 'Stunning crystal beaded necklace perfect for retail or wholesale. Premium quality crystals with brilliant sparkle. Adjustable length (16-22 inches). Lead-free and nickel-free.',
      shortDesc: 'Crystal beaded elegance',
      price: 12.99,
      comparePrice: 18.99,
      costPrice: 4.50,
      wholesalePrice: 8.99,
      vipPrice: 6.99,
      minOrderQty: 3,
      weight: 0.15,
      dimensions: '25cm x 3cm',
      images: JSON.stringify(['https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800']),
      modelImage: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800',
      sku: 'AC-001',
      barcode: '8901234567890',
      inventory: 150,
      categoryId: accessories.id,
      tags: 'Bestseller,Trending',
      isTrending: true,
      isFeatured: true,
    },
    {
      name: 'Pet Collar with LED Light - USB Rechargeable',
      slug: 'pet-collar-led-light',
      description: 'Safety LED collar for dogs and cats. USB rechargeable, multiple colors. Perfect for nighttime walks and pet safety.',
      shortDesc: 'Keep your pet safe at night',
      price: 15.99,
      comparePrice: 22.99,
      costPrice: 5.50,
      wholesalePrice: 11.99,
      vipPrice: 9.99,
      minOrderQty: 5,
      weight: 0.2,
      images: JSON.stringify(['https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800']),
      sku: 'PET-002',
      barcode: '8901234567891',
      inventory: 200,
      categoryId: petSupplies.id,
      tags: 'FDA Approved,Trending',
      isTrending: true,
      isFeatured: true,
      compliance: JSON.stringify([{ type: 'FDA', status: 'Approved' }]),
    },
    {
      name: 'Minimalist Nordic Desk Organizer',
      slug: 'nordic-desk-organizer',
      description: 'Clean lines desk organizer. Perfect for home office or dorm. Scandinavian-inspired design.',
      shortDesc: 'Scandinavian simplicity',
      price: 28.99,
      comparePrice: 38.99,
      costPrice: 12.00,
      wholesalePrice: 22.99,
      vipPrice: 18.99,
      minOrderQty: 2,
      weight: 0.8,
      dimensions: '25x15x12cm',
      images: JSON.stringify(['https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800']),
      sku: 'HOME-003',
      barcode: '8901234567892',
      inventory: 80,
      categoryId: homeDecor.id,
      tags: 'Nordic Style',
      isFeatured: true,
    },
    {
      name: 'Creative LED Message Board - 12 Colors',
      slug: 'led-message-board',
      description: 'USB powered LED board with 12 colors. Draw with your finger! Perfect gift for creative people.',
      shortDesc: 'Express yourself with light',
      price: 19.99,
      comparePrice: 29.99,
      costPrice: 7.50,
      wholesalePrice: 14.99,
      vipPrice: 12.99,
      minOrderQty: 3,
      weight: 0.5,
      images: JSON.stringify(['https://images.unsplash.com/photo-1549490349-8643362247b5?w=800']),
      sku: 'GIFT-004',
      barcode: '8901234567893',
      inventory: 120,
      categoryId: gifts.id,
      tags: 'Trending',
      isTrending: true,
    },
    {
      name: 'Ins-Style Ceramic Vase Set - 3 Pieces',
      slug: 'ins-ceramic-vase-set',
      description: 'Trendy ceramic vase set. Minimalist design for any space. Instagram-worthy décor.',
      shortDesc: 'Instagram-worthy décor',
      price: 34.99,
      comparePrice: 45.99,
      costPrice: 15.00,
      wholesalePrice: 27.99,
      vipPrice: 22.99,
      minOrderQty: 2,
      weight: 1.2,
      dimensions: '15x15x20cm',
      images: JSON.stringify(['https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=800']),
      sku: 'HOME-005',
      barcode: '8901234567894',
      inventory: 60,
      categoryId: homeDecor.id,
      tags: 'Instagram Famous',
      isFeatured: true,
    },
    {
      name: 'Pet Carrier Backpack - Airline Approved',
      slug: 'pet-carrier-backpack',
      description: 'Hands-free pet carrier. Airline approved, ventilation panels. Adventure with your pet!',
      shortDesc: 'Adventure with your pet',
      price: 45.99,
      comparePrice: 59.99,
      costPrice: 22.00,
      wholesalePrice: 38.99,
      vipPrice: 32.99,
      minOrderQty: 2,
      weight: 1.0,
      images: JSON.stringify(['https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800']),
      modelImage: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800',
      sku: 'PET-006',
      barcode: '8901234567895',
      inventory: 45,
      categoryId: petSupplies.id,
      tags: 'Travel Essential',
      isFeatured: true,
      compliance: JSON.stringify([{ type: 'FDA', status: 'Approved' }]),
    },
    {
      name: 'Layered Gold-Plated Charm Bracelet',
      slug: 'gold-layered-charm-bracelet',
      description: 'Elegant layered bracelet with customizable charms. Stackable elegance for any occasion.',
      shortDesc: 'Stackable elegance',
      price: 8.99,
      comparePrice: 14.99,
      costPrice: 3.00,
      wholesalePrice: 5.99,
      vipPrice: 4.49,
      minOrderQty: 5,
      weight: 0.05,
      images: JSON.stringify(['https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800']),
      modelImage: 'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=800',
      sku: 'AC-007',
      barcode: '8901234567896',
      inventory: 300,
      categoryId: accessories.id,
      tags: 'Bestseller,Trending',
      isTrending: true,
    },
    {
      name: 'Wireless Pet Water Fountain - 2L',
      slug: 'wireless-pet-fountain',
      description: 'Silent water fountain with filter. Perfect for cats and small dogs. Keep your pet hydrated!',
      shortDesc: 'Hydration station',
      price: 32.99,
      comparePrice: 42.99,
      costPrice: 14.00,
      wholesalePrice: 26.99,
      vipPrice: 22.99,
      minOrderQty: 3,
      weight: 0.9,
      images: JSON.stringify(['https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=800']),
      sku: 'PET-008',
      barcode: '8901234567897',
      inventory: 90,
      categoryId: petSupplies.id,
      tags: 'Pet Parent Favorite',
      compliance: JSON.stringify([{ type: 'FDA', status: 'Approved' }]),
    },
  ]

  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: product,
      create: product,
    })
  }

  console.log('✅ Products created')

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10)
  
  await prisma.user.upsert({
    where: { email: 'admin@joyhub.com' },
    update: {},
    create: {
      email: 'admin@joyhub.com',
      password: hashedPassword,
      name: 'Admin',
      role: 'ADMIN',
    },
  })

  console.log('✅ Admin user created (admin@joyhub.com / admin123)')
  console.log('')
  console.log('🎉 Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
