import { prisma } from '../prisma.client';
import { DEFAULT_CATEGORIES } from '@/src/domain/services/category.service';

export interface UserProfile {
  clerkId: string;
  monthlyIncome: number | null;
}

export class UserProfilePrismaRepository {
  async findById(clerkId: string): Promise<UserProfile | null> {
    return prisma.userProfile.findUnique({ where: { clerkId } });
  }

  async updateIncome(clerkId: string, monthlyIncome: number | null): Promise<UserProfile> {
    return prisma.userProfile.update({ where: { clerkId }, data: { monthlyIncome } });
  }

  /** Creates profile + seeds default categories if the user is new. */
  async ensureExists(clerkId: string): Promise<UserProfile> {
    const existing = await prisma.userProfile.findUnique({ where: { clerkId } });
    if (existing) return existing;

    const profile = await prisma.userProfile.create({ data: { clerkId } });

    await prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((cat) => ({
        userId: clerkId,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        isDefault: true,
      })),
      skipDuplicates: true,
    });

    return profile;
  }
}
