import bcrypt from 'bcryptjs';
import type { IUserRepository } from '@/src/domain/repositories/user.repository';
import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
import { DEFAULT_CATEGORIES } from '@/src/domain/services/category.service';
import type { RegisterDTO } from '@/src/application/dtos/auth.dto';

export class RegisterUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly categoryRepo: ICategoryRepository
  ) {}

  async execute(dto: RegisterDTO): Promise<{ id: string; email: string }> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new Error('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.userRepo.create({
      email: dto.email,
      password: hashedPassword,
      name: `${dto.firstName} ${dto.lastName}`,
    });

    // Seed default categories
    await this.categoryRepo.createMany(
      DEFAULT_CATEGORIES.map((cat) => ({
        userId: user.id,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        isDefault: true,
      }))
    );

    return { id: user.id, email: user.email };
  }
}
