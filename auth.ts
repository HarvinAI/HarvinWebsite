import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getAuthDb } from '@/lib/auth-db';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const db = await getAuthDb();
          const user = await db.collection('users').findOne({
            email: (credentials.email as string).toLowerCase(),
          });

          if (!user || !user.passwordHash) return null;

          const valid = await bcrypt.compare(credentials.password as string, user.passwordHash);
          if (!valid) return null;

          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
          };
        } catch (err) {
          console.error('[auth] credentials error:', err);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    async signIn({ user, account }: { user: { name?: string | null; email?: string | null }; account: { provider: string } | null }) {
      // Auto-create user doc for Google sign-ins
      if (account?.provider === 'google' && user.email) {
        try {
          const db = await getAuthDb();
          await db.collection('users').updateOne(
            { email: user.email.toLowerCase() },
            {
              $set: { name: user.name || '', provider: 'google', updatedAt: new Date() },
              $setOnInsert: { email: user.email.toLowerCase(), createdAt: new Date() },
            },
            { upsert: true }
          );
        } catch (err) {
          console.error('[auth] google upsert error:', err);
        }
      }
      return true;
    },
    async session({ session }: { session: import('next-auth').Session; token: import('next-auth/jwt').JWT }) {
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
