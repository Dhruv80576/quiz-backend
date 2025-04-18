import { PrismaClient } from '@prisma/client';

// Initialize PrismaClient with error handling
let prisma: PrismaClient;

try {
  prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
    errorFormat: 'pretty',
  });
} catch (error) {
  console.error('Failed to initialize Prisma client:', error);
  process.exit(1);
}

// Function to connect to the database
export const connectDB = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log('Connected to database');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }
};

export default prisma;