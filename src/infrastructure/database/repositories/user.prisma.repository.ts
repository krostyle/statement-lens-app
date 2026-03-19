import type { IUserRepository } from '@/src/domain/repositories/user.repository';
import type { User, CreateUserInput } from '@/src/domain/entities/user';
import { prisma } from '../prisma.client';

export class UserPrismaRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async findByResetToken(token: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { resetToken: token } });
  }

  async create(data: CreateUserInput): Promise<User> {
    return prisma.user.create({ data });
  }

  async updatePassword(id: string, hashedPassword: string): Promise<User> {
    return prisma.user.update({ where: { id }, data: { password: hashedPassword } });
  }

  async setResetToken(id: string, token: string | null, expiry: Date | null): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });
  }

  async updateIncome(id: string, monthlyIncome: number | null): Promise<User> {
    return prisma.user.update({ where: { id }, data: { monthlyIncome } });
  }
}
