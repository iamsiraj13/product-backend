import { PrismaClient, Role, AccountType } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/product';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export async function seedAdmin() {
  console.log('🚀 Starting Admin User Seeding...');

  const adminData = {
    username: process.env.ADMIN_USERNAME || 'admin',
    email: process.env.ADMIN_EMAIL || 'admin@gmail.com',
    password: process.env.ADMIN_PASSWORD || 'password',
    invitationCode: process.env.ADMIN_INVITATION_CODE || 'SYSADMIN',
    balance: parseFloat(process.env.ADMIN_INITIAL_BALANCE || '1000.00'),
  };

  const passwordHash = await bcrypt.hash(adminData.password, 10);

  // Check if admin user already exists by username or email
  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [{ username: adminData.username }, { email: adminData.email }],
    },
  });

  if (existingAdmin) {
    console.log(`ℹ️  Admin user already exists!`);
    console.log(`   - ID: ${existingAdmin.id}`);
    console.log(`   - Username: ${existingAdmin.username}`);
    console.log(`   - Email: ${existingAdmin.email}`);
    console.log(`   - Role: ${existingAdmin.role}`);
    console.log(`   - Invitation Code: ${existingAdmin.invitationCode}`);
    return existingAdmin;
  }

  const admin = await prisma.user.create({
    data: {
      username: adminData.username,
      email: adminData.email,
      passwordHash: passwordHash,
      role: Role.ADMIN,
      accountType: AccountType.MAIN,
      invitationCode: adminData.invitationCode,
      balance: adminData.balance,
      isActive: true,
    },
  });

  console.log(`✅ Admin user successfully created!`);
  console.log(`   - ID: ${admin.id}`);
  console.log(`   - Username: ${admin.username}`);
  console.log(`   - Email: ${admin.email}`);
  console.log(`   - Password: ${adminData.password}`);
  console.log(`   - Role: ${admin.role}`);
  console.log(`   - Invitation Code: ${admin.invitationCode}`);
  console.log(`   - Balance: $${admin.balance}`);

  return admin;
}

async function main() {
  try {
    await seedAdmin();
  } catch (error) {
    console.error('❌ Failed to seed admin user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (require.main === module) {
  main();
}
