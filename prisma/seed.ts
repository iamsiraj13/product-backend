import { PrismaClient, Role, AccountType } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/product';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  const adminPasswordHash = await bcrypt.hash('AdminPass123!', 10);
  const agentPasswordHash = await bcrypt.hash('AgentPass123!', 10);
  const userPasswordHash = await bcrypt.hash('UserPass123!', 10);

  // 1. Seed System Admin
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@platform.com',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      accountType: AccountType.MAIN,
      invitationCode: 'SYSADMIN',
      balance: 1000.00,
    },
  });
  console.log(`Admin user created/verified: ${admin.username} (Code: ${admin.invitationCode})`);

  // 2. Seed Operations Agent
  const agent = await prisma.user.upsert({
    where: { username: 'agent1' },
    update: {},
    create: {
      username: 'agent1',
      email: 'agent1@platform.com',
      passwordHash: agentPasswordHash,
      role: Role.AGENT,
      accountType: AccountType.MAIN,
      invitationCode: 'AGENT001',
      balance: 500.00,
    },
  });
  console.log(`Agent user created/verified: ${agent.username}`);

  // 3. Seed Demo User
  const demoUser = await prisma.user.upsert({
    where: { username: 'user1' },
    update: {},
    create: {
      username: 'user1',
      email: 'user1@platform.com',
      passwordHash: userPasswordHash,
      role: Role.USER,
      accountType: AccountType.MAIN,
      invitationCode: 'USER0001',
      balance: 100.00,
      invitedById: admin.id,
    },
  });
  console.log(`Demo user created/verified: ${demoUser.username} (Balance: $${demoUser.balance})`);

  // 4. Seed Products
  const sampleProducts = [
    {
      title: 'Wireless Ergonomic Earbuds',
      image: '/uploads/sample-earbuds.png',
      price: 15.00,
      commissionRate: 5.00,
      isHomeProduct: true,
    },
    {
      title: 'Smart Fitness Tracker Watch',
      image: '/uploads/sample-watch.png',
      price: 35.00,
      commissionRate: 8.00,
      isHomeProduct: true,
    },
    {
      title: 'Portable Bluetooth Speaker',
      image: '/uploads/sample-speaker.png',
      price: 50.00,
      commissionRate: 10.00,
      isHomeProduct: false,
    },
    {
      title: 'Mechanical Gaming Keyboard',
      image: '/uploads/sample-keyboard.png',
      price: 75.00,
      commissionRate: 12.00,
      isHomeProduct: false,
    },
    {
      title: 'Ultra-HD Noise Canceling Headphones',
      image: '/uploads/sample-headphones.png',
      price: 90.00,
      commissionRate: 15.00,
      isHomeProduct: true,
    },
  ];

  for (const prod of sampleProducts) {
    const existing = await prisma.product.findFirst({
      where: { title: prod.title },
    });
    if (!existing) {
      const commission = (prod.price * (prod.commissionRate / 100)).toFixed(2);
      await prisma.product.create({
        data: {
          title: prod.title,
          image: prod.image,
          price: prod.price,
          commissionRate: prod.commissionRate,
          commission: parseFloat(commission),
          isHomeProduct: prod.isHomeProduct,
          isActive: true,
        },
      });
    }
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
