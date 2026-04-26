import type { MonthClose, CreateMonthCloseInput } from '../entities/month-close';

export interface IMonthCloseRepository {
  findByUserId(userId: string): Promise<MonthClose[]>;
  findById(id: string, userId: string): Promise<MonthClose | null>;
  create(data: CreateMonthCloseInput): Promise<MonthClose>;
  update(id: string, userId: string, data: Partial<Pick<MonthClose, 'notes' | 'aiSuggestions'>>): Promise<MonthClose>;
  delete(id: string, userId: string): Promise<void>;
  existsForMonth(userId: string, month: string): Promise<boolean>;
}
