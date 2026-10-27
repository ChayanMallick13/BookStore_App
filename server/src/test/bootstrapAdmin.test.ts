import { PassThrough, Writable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import {
  BootstrapRefusalError,
  bootstrapAdmin,
  describeDatabaseTarget,
  promptMaskedPassword,
} from '../scripts/bootstrapAdmin.js';

function testIo() {
  const output = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const input = new PassThrough() as PassThrough & { setRawMode: (mode: boolean) => void };
  input.setRawMode = vi.fn();
  return { input, output };
}

function dependencies(overrides: Record<string, unknown>) {
  const io = testIo();
  return {
    io,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    hashPassword: vi.fn().mockResolvedValue('hashed-password'),
    ...overrides,
  };
}

async function run(options: Record<string, unknown>, deps: Record<string, unknown>) {
  return bootstrapAdmin({
    email: 'admin@example.com',
    password: 'a-strong-password',
    environment: 'production',
    mongoUri: 'mongodb://secret-user:secret-pass@db.example.com:27017/books_bin',
    confirmTarget: vi.fn().mockResolvedValue(true),
    dependencies: deps as never,
    ...options,
  });
}

describe('bootstrapAdmin', () => {
  it('creates a new account with bcrypt-compatible hashing and disconnects', async () => {
    const deps = dependencies({});

    await run({}, deps);

    expect(deps.hashPassword).toHaveBeenCalledWith('a-strong-password', 12);
    expect(deps.create).toHaveBeenCalledWith({
      email: 'admin@example.com',
      name: 'Books Bin Admin',
      passwordHash: 'hashed-password',
      role: 'admin',
      emailVerified: true,
    });
    expect(deps.disconnect).toHaveBeenCalledOnce();
  });

  it('reports an existing admin without changing or creating an account', async () => {
    const deps = dependencies({
      findOne: vi.fn().mockResolvedValue({ role: 'admin' }),
    });

    await run({}, deps);

    expect(deps.hashPassword).not.toHaveBeenCalled();
    expect(deps.create).not.toHaveBeenCalled();
    expect(deps.disconnect).toHaveBeenCalledOnce();
  });

  it('refuses to promote an existing customer and explains the safe alternative', async () => {
    const deps = dependencies({
      findOne: vi.fn().mockResolvedValue({ role: 'customer' }),
    });

    await expect(run({}, deps)).rejects.toThrow(BootstrapRefusalError);

    expect(deps.create).not.toHaveBeenCalled();
    expect(deps.disconnect).toHaveBeenCalledOnce();
  });

  it('rejects passwords shorter than eight characters before connecting', async () => {
    const deps = dependencies({});

    await expect(run({ password: 'short' }, deps)).rejects.toThrow('at least 8 characters');
    expect(deps.connect).not.toHaveBeenCalled();
    expect(deps.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects after a database operation error', async () => {
    const failure = new Error('database operation failed');
    const deps = dependencies({
      findOne: vi.fn().mockRejectedValue(failure),
    });

    await expect(run({}, deps)).rejects.toBe(failure);
    expect(deps.disconnect).toHaveBeenCalledOnce();
  });

  it('does not disconnect when the initial connection fails', async () => {
    const deps = dependencies({
      connect: vi.fn().mockRejectedValue(new Error('connection failed')),
    });

    await expect(run({}, deps)).rejects.toThrow('connection failed');
    expect(deps.disconnect).not.toHaveBeenCalled();
  });

  it('identifies the target database without exposing credentials', () => {
    expect(describeDatabaseTarget(
      'production',
      'mongodb://secret-user:secret-pass@db.example.com:27017/books_bin?authSource=admin',
    )).toBe('production/db.example.com/books_bin');
    expect(describeDatabaseTarget('production', 'mongodb://user:pass@db.example.com')).not.toContain('secret');
  });

  it('masks password input and restores terminal raw mode', async () => {
    const input = new PassThrough() as PassThrough & { setRawMode: (mode: boolean) => void };
    input.setRawMode = vi.fn();
    const output = new PassThrough();

    const prompt = promptMaskedPassword('Password: ', { input, output });
    input.write('hidden-secret\r');

    await expect(prompt).resolves.toBe('hidden-secret');
    expect(input.setRawMode).toHaveBeenNthCalledWith(1, true);
    expect(input.setRawMode).toHaveBeenLastCalledWith(false);
  });

  it('does not display password input in the output stream', async () => {
    const input = new PassThrough() as PassThrough & { setRawMode: (mode: boolean) => void };
    input.setRawMode = vi.fn();
    let rendered = '';
    const output = new Writable({
      write(chunk, _encoding, callback) {
        rendered += chunk.toString();
        callback();
      },
    });

    const prompt = promptMaskedPassword('Password: ', { input, output });
    input.write('hidden-secret\r');

    await prompt;
    expect(rendered).toBe('Password: \n');
  });
});
