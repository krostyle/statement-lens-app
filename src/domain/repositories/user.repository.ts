import type { User, CreateUserInput } from '../entities/user';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByResetToken(token: string): Promise<User | null>;
  create(data: CreateUserInput): Promise<User>;
  updatePassword(id: string, hashedPassword: string): Promise<User>;
  setResetToken(id: string, token: string | null, expiry: Date | null): Promise<User>;
  updateIncome(id: string, monthlyIncome: number | null): Promise<User>;
}
