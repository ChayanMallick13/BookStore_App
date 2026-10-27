import dotenv from 'dotenv';
import slugify from 'slugify';
import { connectDb, disconnectDb } from '../config/db.js';
import { Category } from '../models/Category.js';
import { Author } from '../models/Author.js';
import { Book } from '../models/Book.js';
import { Coupon } from '../models/Coupon.js';
import { logger } from '../utils/logger.js';
import { errorDetails } from '../utils/errorDetails.js';

dotenv.config();

const sampleBooks = [
  {
    title: 'The Midnight Library',
    isbn: '9780525559474',
    author: 'Matt Haig',
    category: 'Fiction',
    price: 599,
    discountPercent: 10,
    stock: 42,
  },
  {
    title: 'Atomic Habits',
    isbn: '9780735211292',
    author: 'James Clear',
    category: 'Self-Help',
    price: 499,
    discountPercent: 15,
    stock: 80,
  },
  {
    title: 'Project Hail Mary',
    isbn: '9780593135204',
    author: 'Andy Weir',
    category: 'Science Fiction',
    price: 649,
    discountPercent: 5,
    stock: 25,
  },
  {
    title: 'Ikigai',
    isbn: '9781846046038',
    author: 'Héctor García',
    category: 'Self-Help',
    price: 399,
    discountPercent: 0,
    stock: 60,
  },
];

async function upsertCategory(name: string) {
  const slug = slugify(name, { lower: true, strict: true });
  return Category.findOneAndUpdate({ slug }, { name, slug, isActive: true }, { upsert: true, new: true });
}

async function upsertAuthor(name: string) {
  const slug = slugify(name, { lower: true, strict: true });
  return Author.findOneAndUpdate({ slug }, { name, slug, isActive: true }, { upsert: true, new: true });
}

async function run() {
  await connectDb();

  for (const sample of sampleBooks) {
    const category = await upsertCategory(sample.category);
    const author = await upsertAuthor(sample.author);
    const slug = slugify(sample.title, { lower: true, strict: true });
    await Book.findOneAndUpdate(
      { isbn: sample.isbn },
      {
        title: sample.title,
        slug,
        isbn: sample.isbn,
        description: `${sample.title} — a curated title for Books Bin readers. Explore themes of wonder, growth, and imagination in this beautifully crafted edition.`,
        category: category!._id,
        author: author!._id,
        publisher: 'Books Bin Press',
        price: sample.price,
        discountPercent: sample.discountPercent,
        stock: sample.stock,
        featured: true,
        isActive: true,
        isArchived: false,
        coverImages: [],
      },
      { upsert: true, new: true },
    );
  }

  await Coupon.findOneAndUpdate(
    { code: 'WELCOME10' },
    {
      code: 'WELCOME10',
      description: '10% off welcome offer',
      discountType: 'percent',
      discountValue: 10,
      minOrderAmount: 500,
      maxUses: 1000,
      isActive: true,
    },
    { upsert: true },
  );

  console.log('Seed completed');
  await disconnectDb();
}

run().catch((err) => {
  logger.error('Seed script failed', { operation: 'seed', error: errorDetails(err) });
  process.exit(1);
});
