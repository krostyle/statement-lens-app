/**
 * Edge-compatible NextAuth config — used ONLY by middleware.
 * No Node.js-only deps (no prisma, no bcrypt).
 * JWT decode is enough to check if a session exists.
 */
import NextAuth from 'next-auth';

export const { auth } = NextAuth({
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
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
