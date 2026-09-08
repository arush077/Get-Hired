import { randomUUID } from "node:crypto";

export class User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(opts?: {
    id?: string;
    name?: string;
    email?: string;
    passwordHash?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    const now = new Date();
    this.id = opts?.id ?? randomUUID();
    this.name = opts?.name ?? "";
    this.email = opts?.email ?? "";
    this.passwordHash = opts?.passwordHash ?? "";
    this.createdAt = opts?.createdAt ?? now;
    this.updatedAt = opts?.updatedAt ?? now;
  }
}
