import dotenv from 'dotenv';
import readline from 'readline';
import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from '../config/db.js';
import { User } from '../models/User.js';

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
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL ?? 'admin@bookhaven.local';
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
      console.log('Updated existing user to admin:', email);
    } else {
      console.log('Admin already exists:', email);
    }
    await disconnectDb();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({
    email: email.toLowerCase(),
    name: 'BookHaven Admin',
    passwordHash,
    role: 'admin',
  });
  console.log('Admin provisioned:', email);
  await disconnectDb();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
