import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/src/infrastructure/database/prisma.client';
import { loginSchema } from '@/src/lib/validations/auth.schema';

class InvalidCredentialsError extends CredentialsSignin {
  code = 'invalid_credentials';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          console.warn('[auth] Login validation failed:', parsed.error.flatten().fieldErrors);
          throw new InvalidCredentialsError();
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: parsed.data.email },
          });

          if (!user) {
            console.warn('[auth] Login failed: user not found —', parsed.data.email);
            throw new InvalidCredentialsError();
          }

          const passwordMatch = await bcrypt.compare(parsed.data.password, user.password);
          if (!passwordMatch) {
            console.warn('[auth] Login failed: wrong password —', parsed.data.email);
            throw new InvalidCredentialsError();
          }

          return { id: user.id, email: user.email, name: user.name };
        } catch (err) {
          if (err instanceof InvalidCredentialsError) throw err;
          console.error('[auth] Unexpected error during login:', err);
          throw new Error('server_error');
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
