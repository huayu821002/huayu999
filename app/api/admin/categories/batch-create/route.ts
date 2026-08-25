import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 4大类和二级分类数据
const categoriesData = [
  {
    name: 'Party Supplies',
    slug: 'party-supplies',
    description: 'Party decorations, tableware, favors and more for all occasions',
    image: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400',
    children: [
      { name: 'Balloons & Banners', slug: 'balloons-banners', description: 'Party balloons, banners, and decorations' },
      { name: 'LED String Lights', slug: 'led-string-lights', description: 'LED party lights and decorations' },
      { name: 'Table Decorations', slug: 'table-decorations', description: 'Table centerpieces and decorations' },
      { name: 'Paper Cup & Plate Sets', slug: 'paper-cup-plate-sets', description: 'Disposable paper party tableware' },
      { name: 'Disposable Cutlery Sets', slug: 'disposable-cutlery-sets', description: 'Plastic cutlery for parties' },
      { name: 'Guest Gift Bags', slug: 'guest-gift-bags', description: 'Party favor bags and packaging' },
      { name: 'Candy Wrappers', slug: 'candy-wrappers', description: 'Candy and snack wrappers' },
      { name: 'Halloween Masks & Costumes', slug: 'halloween-masks-costumes', description: 'Halloween costumes and accessories' },
    ]
  },
  {
    name: 'Pet Supplies',
    slug: 'pet-supplies',
    description: 'Pet toys, bedding, feeding and accessories for dogs and cats',
    image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
    children: [
      { name: 'Chew Toys for Dogs', slug: 'chew-toys-dogs', description: 'Dog chew toys and dental toys' },
      { name: 'Cat Scratching Posts', slug: 'cat-scratching-posts', description: 'Cat scratchers and climbing toys' },
      { name: 'Interactive Toys', slug: 'interactive-pet-toys', description: 'Electronic and interactive pet toys' },
      { name: 'Foldable Pet Beds', slug: 'foldable-pet-beds', description: 'Collapsible pet beds and mats' },
      { name: 'Pet Mats & Blankets', slug: 'pet-mats-blankets', description: 'Pet bedding and comfort items' },
      { name: 'Water Feeders', slug: 'pet-water-feeders', description: 'Automatic waterers and fountains' },
      { name: 'Food & Water Bowls', slug: 'pet-food-water-bowls', description: 'Pet feeding bowls' },
      { name: 'Collars & Leashes', slug: 'pet-collars-leashes', description: 'Dog and cat collars and leashes' },
      { name: 'Holiday Pet Costumes', slug: 'holiday-pet-costumes', description: 'Pet costumes for holidays' },
    ]
  },
  {
    name: 'Fashion Accessories',
    slug: 'fashion-accessories',
    description: 'Trendy hair accessories, jewelry, sunglasses and more',
    image: 'https://images.unsplash.com/photo-1616150638538-ffb0679a3fc4?w=400',
    children: [
      { name: 'Hair Tie & Scrunchie Sets', slug: 'hair-tie-scrunchie-sets', description: 'Hair ties and scrunchie sets' },
      { name: 'Hair Clips & Bobby Pins', slug: 'hair-clips-bobby-pins', description: 'Decorative hair clips and pins' },
      { name: 'Hair Sticks & Claws', slug: 'hair-sticks-claws', description: 'Hair sticks and claw clips' },
      { name: 'Stud Earrings & Clips', slug: 'stud-earrings-clips', description: 'Earrings and ear clips' },
      { name: 'Necklace Sets', slug: 'necklace-sets', description: 'Necklace and pendant sets' },
      { name: 'Bracelets & Anklets', slug: 'bracelets-anklets', description: 'Fashion bracelets and anklets' },
      { name: 'Fashion Sunglasses', slug: 'fashion-sunglasses', description: 'Trendy sunglasses' },
      { name: 'Eyeglass Chains & Cases', slug: 'eyeglass-chains-cases', description: 'Glasses accessories' },
      { name: 'Fashion Belts', slug: 'fashion-belts', description: 'Women belts and waist belts' },
      { name: 'Scarves & Shawls', slug: 'scarves-shawls', description: 'Fashion scarves and wraps' },
    ]
  },
  {
    name: 'Home Decor & Storage',
    slug: 'home-decor-storage',
    description: 'Home organization, wall decor, candles and fragrances',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400',
    children: [
      { name: 'Closet Organizers', slug: 'closet-organizers', description: 'Closet storage and dividers' },
      { name: 'Drawer Dividers', slug: 'drawer-dividers', description: 'Drawer organizers and separators' },
      { name: 'Bathroom Storage', slug: 'bathroom-storage', description: 'Bathroom organization' },
      { name: 'Kitchen Shelf Organizers', slug: 'kitchen-shelf-organizers', description: 'Kitchen storage solutions' },
      { name: 'Wall Art & Photo Frames', slug: 'wall-art-photo-frames', description: 'Wall decorations and frames' },
      { name: 'Wall Hangings', slug: 'wall-hangings', description: 'Wall decor and tapestries' },
      { name: 'Wall Shelves', slug: 'wall-shelves', description: 'Floating and decorative shelves' },
      { name: 'Vases & Jars', slug: 'vases-jars', description: 'Decorative vases and containers' },
      { name: 'Desk Decor & Figurines', slug: 'desk-decor-figurines', description: 'Desktop decorations' },
      { name: 'Photo Frames', slug: 'photo-frames', description: 'Picture frames' },
      { name: 'Scented Candle Sets', slug: 'scented-candle-sets', description: 'Aromatherapy candles' },
      { name: 'Diffusers & Oils', slug: 'diffusers-oils', description: 'Essential oil diffusers' },
    ]
  }
]

export async function POST() {
  try {
    let parentCount = 0
    let childCount = 0
    const results: any = []

    for (const parent of categoriesData) {
      // Create or find parent category
      let parentCategory = await prisma.category.findUnique({
        where: { slug: parent.slug }
      })

      if (!parentCategory) {
        parentCategory = await prisma.category.create({
          data: {
            name: parent.name,
            slug: parent.slug,
            description: parent.description,
            image: parent.image,
          }
        })
        parentCount++
      }

      results.push({
        category: parentCategory.name,
        childrenAdded: 0
      })

      // Create children
      for (const child of parent.children || []) {
        const existingChild = await prisma.category.findUnique({
          where: { slug: child.slug }
        })

        if (!existingChild) {
          await prisma.category.create({
            data: {
              name: child.name,
              slug: child.slug,
              description: child.description,
              parentId: parentCategory.id,
            }
          })
          childCount++
          results[results.length - 1].childrenAdded++
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Categories added successfully',
        parentsCreated: parentCount,
        childrenCreated: childCount,
        details: results
      }
    })
  } catch (error: any) {
    console.error('Error adding categories:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
