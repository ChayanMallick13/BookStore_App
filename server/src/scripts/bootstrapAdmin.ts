import dotenv from 'dotenv';
import readline from 'readline';
import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from '../config/db.js';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';
import { errorDetails } from '../utils/errorDetails.js';

dotenv.config();

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function run() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL ?? 'admin@booksbin.local';
  let password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!password) {
    password = await prompt('Enter admin password (min 8 chars): ');
  }
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  await connectDb();
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.log('Updated the configured account to administrator.');
    } else {
      console.log('Administrator account already exists.');
    }
    await disconnectDb();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({
    email: email.toLowerCase(),
    name: 'Books Bin Admin',
    passwordHash,
    role: 'admin',
  });
  console.log('Administrator account provisioned.');
  await disconnectDb();
}

run().catch((err) => {
  logger.error('Admin bootstrap failed', { operation: 'admin.bootstrap', error: errorDetails(err) });
  process.exit(1);
});
