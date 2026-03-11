import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';

export class DeleteCategoryUseCase {
  constructor(private readonly categoryRepo: ICategoryRepository) {}

  async execute(id: string, userId: string): Promise<void> {
    const category = await this.categoryRepo.findById(id);
    if (!category) throw new Error('Category not found');
    if (category.userId !== userId) throw new Error('Forbidden');

    await this.categoryRepo.delete(id);
  }
}
