import type { IMonthCloseRepository } from '@/src/domain/repositories/month-close.repository';
import type { MonthClose } from '@/src/domain/entities/month-close';

export class ListMonthClosesUseCase {
  constructor(private readonly monthCloseRepo: IMonthCloseRepository) {}

  async execute(userId: string): Promise<MonthClose[]> {
    return this.monthCloseRepo.findByUserId(userId);
  }
}
