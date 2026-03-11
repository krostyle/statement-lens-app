import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { IUserRepository } from '@/src/domain/repositories/user.repository';

export interface IEmailService {
  sendPasswordReset(email: string, resetUrl: string): Promise<void>;
}

export class ForgotPasswordUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly emailService: IEmailService,
    private readonly appUrl: string
  ) {}

  async execute(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return; // Don't reveal if email exists

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await this.userRepo.setResetToken(user.id, token, expiry);
    const resetUrl = `${this.appUrl}/recover-password?token=${token}`;
    await this.emailService.sendPasswordReset(user.email, resetUrl);
  }
}

export class ResetPasswordUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(token: string, newPassword: string): Promise<void> {
    const user = await this.userRepo.findByResetToken(token);
    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      throw new Error('Invalid or expired reset token');
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.userRepo.updatePassword(user.id, hashed);
    await this.userRepo.setResetToken(user.id, null, null);
  }
}
