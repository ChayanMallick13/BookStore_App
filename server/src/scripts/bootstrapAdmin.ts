import dotenv from 'dotenv';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from '../config/db.js';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';
import { errorDetails } from '../utils/errorDetails.js';
import type { Readable, Writable } from 'node:stream';

dotenv.config();

export interface BootstrapIo {
  input: Readable & { setRawMode?: (mode: boolean) => void };
  output: Writable;
}

export interface BootstrapDependencies {
  connect: typeof connectDb;
  disconnect: typeof disconnectDb;
  findOne: typeof User.findOne;
  create: typeof User.create;
  hashPassword: (password: string, rounds: number) => Promise<string>;
  io: BootstrapIo;
}

export class BootstrapRefusalError extends Error {}

const defaultDependencies: Omit<BootstrapDependencies, 'io'> = {
  connect: connectDb,
  disconnect: disconnectDb,
  findOne: User.findOne.bind(User),
  create: User.create.bind(User),
  hashPassword: bcrypt.hash,
};

function write(output: Writable, text: string) {
  output.write(text);
}

async function promptVisible(question: string, io: BootstrapIo): Promise<string> {
  const rl = readline.createInterface({ input: io.input, output: io.output, terminal: false });
  try {
    return await new Promise((resolve) => {
      rl.question(question, (answer) => resolve(answer.trim()));
    });
  } finally {
    rl.close();
  }
}

export async function promptMaskedPassword(question: string, io: BootstrapIo): Promise<string> {
  if (!io.input.setRawMode) {
    throw new Error('Password entry requires an interactive terminal');
  }

  write(io.output, question);
  let password = '';
  const wasRaw = Boolean((io.input as NodeJS.ReadStream).isRaw);

  try {
    io.input.setRawMode(true);
    return await new Promise((resolve, reject) => {
      const onData = (chunk: Buffer | string) => {
        const value = chunk.toString();
        for (const character of value) {
          if (character === '\u0003') {
            cleanup();
            reject(new Error('Password entry cancelled'));
            return;
          }
          if (character === '\r' || character === '\n') {
            const entered = password;
            cleanup();
            write(io.output, '\n');
            resolve(entered);
            return;
          }
          if (character === '\u007f' || character === '\b') {
            password = password.slice(0, -1);
          } else if (!['\u0003', '\u0004'].includes(character)) {
            password += character;
          }
        }
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        io.input.off('data', onData);
        io.input.off('error', onError);
        io.input.setRawMode?.(wasRaw);
      };
      io.input.on('data', onData);
      io.input.on('error', onError);
    });
  } catch (error) {
    io.input.setRawMode?.(wasRaw);
    throw error;
  }
}

export function describeDatabaseTarget(environment: string, mongoUri: string): string {
  try {
    const target = new URL(mongoUri);
    const database = decodeURIComponent(target.pathname.replace(/^\//, ''));
    if (target.hostname && database) return `${environment}/${target.hostname}/${database}`;
  } catch {
    // Fall through to a credential-free, intentionally vague target.
  }
  return `${environment}/configured MongoDB database`;
}

export async function bootstrapAdmin(options: {
  email: string;
  password?: string;
  environment: string;
  mongoUri: string;
  askPassword?: (io: BootstrapIo) => Promise<string>;
  confirmTarget?: (target: string, io: BootstrapIo) => Promise<boolean>;
  dependencies?: Partial<BootstrapDependencies>;
}) {
  const io = options.dependencies?.io ?? {
    input: process.stdin,
    output: process.stdout,
  };
  const dependencies: BootstrapDependencies = {
    ...defaultDependencies,
    ...options.dependencies,
    io,
  };

  const email = options.email.trim().toLowerCase();
  const target = describeDatabaseTarget(options.environment, options.mongoUri);
  write(io.output, `Target: ${target}\nAccount: ${email}\n`);

  const confirmTarget = options.confirmTarget
    ?? (async (_target: string, promptIo: BootstrapIo) => {
      const answer = await promptVisible('Type YES to continue: ', promptIo);
      return answer === 'YES';
    });
  if (!await confirmTarget(target, io)) {
    throw new BootstrapRefusalError('Bootstrap cancelled: target was not confirmed');
  }

  const password = options.password ?? await (options.askPassword ?? ((promptIo) =>
    promptMaskedPassword('Enter admin password (min 8 chars): ', promptIo)))(io);
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  let connected = false;
  try {
    await dependencies.connect();
    connected = true;
    const existing = await dependencies.findOne({ email });
    if (existing) {
      if (existing.role === 'admin') {
        write(io.output, 'Administrator account already exists.\n');
        return;
      }
      throw new BootstrapRefusalError(
        'Existing non-admin account found; role was not changed. Use a reviewed admin role-management workflow instead.',
      );
    }

    const passwordHash = await dependencies.hashPassword(password, 12);
    await dependencies.create({
      email,
      name: 'Books Bin Admin',
      passwordHash,
      role: 'admin',
      emailVerified: true,
    });
    write(io.output, 'Administrator account provisioned.\n');
  } finally {
    if (connected) await dependencies.disconnect();
  }
}

export async function runBootstrap() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL ?? 'admin@booksbin.local';
  await bootstrapAdmin({
    email,
    password: process.env.ADMIN_BOOTSTRAP_PASSWORD,
    environment: process.env.NODE_ENV ?? 'development',
    mongoUri: process.env.MONGODB_URI ?? '',
  });
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  runBootstrap().catch((error) => {
    logger.error('Admin bootstrap failed', {
      operation: 'admin.bootstrap',
      error: errorDetails(error),
    });
    process.exitCode = 1;
  });
}
