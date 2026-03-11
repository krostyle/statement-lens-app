export interface User {
  id: string;
  email: string;
  password: string;
  name?: string | null;
  resetToken?: string | null;
  resetTokenExpiry?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateUserInput = Pick<User, 'email' | 'password' | 'name'>;
