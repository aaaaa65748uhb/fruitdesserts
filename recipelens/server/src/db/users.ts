import { randomUUID } from 'node:crypto';
import type { Db } from './index.js';
import { nowIso } from './index.js';

export interface UserRow {
  id: string;
  email: string;
  email_lower: string;
  display_name: string;
  password_hash: string;
  token_version: number;
  created_at: string;
  updated_at: string;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export function toPublicUser(row: UserRow): PublicUser {
  return { id: row.id, email: row.email, displayName: row.display_name, createdAt: row.created_at };
}

export class UserRepo {
  constructor(private readonly db: Db) {}

  create(input: { email: string; displayName: string; passwordHash: string }): UserRow {
    const now = nowIso();
    const row: UserRow = {
      id: randomUUID(),
      email: input.email.trim(),
      email_lower: input.email.trim().toLowerCase(),
      display_name: input.displayName.trim(),
      password_hash: input.passwordHash,
      token_version: 1,
      created_at: now,
      updated_at: now,
    };
    this.db
      .prepare(
        `INSERT INTO users (id, email, email_lower, display_name, password_hash, token_version, created_at, updated_at)
         VALUES (@id, @email, @email_lower, @display_name, @password_hash, @token_version, @created_at, @updated_at)`,
      )
      .run(row);
    return row;
  }

  findByEmail(email: string): UserRow | null {
    return (this.db.prepare('SELECT * FROM users WHERE email_lower = ?').get(email.trim().toLowerCase()) as UserRow | undefined) ?? null;
  }

  findById(id: string): UserRow | null {
    return (this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined) ?? null;
  }

  /** Invalidates every existing session for the user (logout-everywhere). */
  bumpTokenVersion(id: string): number {
    const row = this.db
      .prepare('UPDATE users SET token_version = token_version + 1, updated_at = ? WHERE id = ? RETURNING token_version')
      .get(nowIso(), id) as { token_version: number } | undefined;
    return row?.token_version ?? 0;
  }

  updateProfile(id: string, displayName: string): UserRow | null {
    this.db.prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?').run(displayName.trim(), nowIso(), id);
    return this.findById(id);
  }
}
