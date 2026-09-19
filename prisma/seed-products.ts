import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/product';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const productTitles = [
  'Over-Ear Wireless Headphones',
  'Noise-Canceling Earbuds',
  'Smartwatch Series X',
  'Fitness Activity Tracker',
  'RGB Mechanical Gaming Keyboard',
  'Wireless Optical Gaming Mouse',
  'Ultra-HD 4K Webcam',
  'Dual-Band Wi-Fi 6 Router',
  'Portable Power Bank 20000mAh',
  'Magnetic Wireless Charger Stand',
  'Bluetooth Waterproof Speaker',
  'Aluminium Laptop Stand',
  'Ergonomic Mesh Office Chair',
  'USB-C Multi-Port Hub Adapter',
  'Electric Desk Fan with LED',
  'Smart LED Desk Lamp',
  'Leather Laptop Sleeve 15-inch',
  'Smart Temperature Control Mug',
  'High-Speed NVMe SSD Enclosure',
  'Streamer Condenser Microphone',
  'HD Portable Video Projector',
  'Sonic Electric Toothbrush',
  'Wireless Earbuds with Charging Case',
  'Smart Body Fat Scale',
  'Compact Air Purifier for Home',
  'Action Camera 4K Ultra HD',
  'Gimbal Stabilizer for Smartphone',
  'Noise-Isolating Gaming Headset',
  'Portable Espresso Maker',
  'Stainless Steel Insulated Bottle',
  'Ultra-Thin Wireless Charging Pad',
  'Foldable Drone with 4K Camera',
  'Smart Doorbell with Video Camera',
  'VR Headset with Motion Controllers',
  'High-Resolution Audio Player',
  'Solar Powered Backpack Charger',
  'Car Dash Cam 1080P Front & Rear',
  'Smart Robot Vacuum Cleaner',
  'Subwoofer Bass Soundbar System',
  'Wireless Key Finder & Item Tracker',
  'Smart RGB Ambient Light Strip',
  'Heated Winter Jacket for Men',
  'Digital Drawing Tablet with Pen',
  'Fast Wireless Car Mount Charger',
  'Bluetooth Beanie Hat with Speakers',
  'Smart Plug Outlet with Wi-Fi Control',
  'High-Precision Digital Caliper',
  'Noise Reduction Ear Plugs',
  'Automatic Milk Frother & Steamer',
  'Adjustable Phone Desk Stand',
];

const sampleImages = [
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1600003014755-ba31aa59c4b6?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80',
];

async function main() {
  console.log('Seeding 50 random marketplace products...');

  interface SeedProduct {
    title: string;
    image: string;
    price: number;
    commissionRate: number;
    commission: number;
    isHomeProduct: boolean;
    isActive: boolean;
  }

  const productsToCreate: SeedProduct[] = [];

  for (let i = 0; i < 50; i++) {
    const title = productTitles[i] || `Premium Tech Item #${i + 1}`;
    const image = sampleImages[i % sampleImages.length];
    
    // Price between $12.00 and $480.00
    const price = parseFloat((Math.floor(Math.random() * 468) + 12).toFixed(2));
    
    // Commission rate between 2% and 15%
    const commissionRate = parseFloat((Math.random() * 13 + 2).toFixed(2));
    
    // Calculate total commission dollar value
    const commission = parseFloat((price * (commissionRate / 100)).toFixed(2));
    
    // First 10 items marked as home product, or 20% chance
    const isHomeProduct = i < 10 || Math.random() < 0.2;

    productsToCreate.push({
      title,
      image,
      price,
      commissionRate,
      commission,
      isHomeProduct,
      isActive: true,
    });
  }

  let createdCount = 0;
  for (const prod of productsToCreate) {
    const existing = await prisma.product.findFirst({
      where: { title: prod.title },
    });

    if (!existing) {
      await prisma.product.create({
        data: prod,
      });
      createdCount++;
    }
  }

  console.log(`Successfully seeded ${createdCount} new products into the database! (Total evaluated: 50)`);
}

main()
  .catch((e) => {
    console.error('Seeding products failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
