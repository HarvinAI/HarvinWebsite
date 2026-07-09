import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getAuthDb } from '@/lib/auth-db';

// In production, force the canonical site URL when the deployed NEXTAUTH_URL is
// missing or still points at localhost. Otherwise NextAuth builds post-login
// redirects (and the Google OAuth callback) against localhost, sending signed-in
// users to http://localhost:3000.
if (process.env.NODE_ENV === 'production' &&
    (!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL.includes('localhost'))) {
  process.env.NEXTAUTH_URL = 'https://www.harvin.ai';
}

// Platform admins — only these emails can access the dashboard. This hardcoded
// list is the source of truth; ADMIN_EMAILS / ADMIN_EMAIL env values are merged in.
const DEFAULT_ADMIN_EMAILS = [
  'rahul@harvin.ai',
  'admin@harvin.ai',
  'bharath@thyleads.com',
  'mridul@thyleads.com',
  'naman@thyleads.com',
];
export const ADMIN_EMAILS = Array.from(new Set([
  ...DEFAULT_ADMIN_EMAILS,
  ...(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '').split(','),
].map(e => e.trim().toLowerCase()).filter(Boolean)));

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      // Always show the Google account chooser instead of silently reusing the
      // last-signed-in account.
      authorization: { params: { prompt: 'select_account' } },
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
    async jwt({ token, user }: { token: import('next-auth/jwt').JWT; user?: { id?: string; email?: string | null } }) {
      if (user?.id) {
        token.userId = user.id;
      } else if (!token.userId && token.email) {
        try {
          const db = await getAuthDb();
          const doc = await db.collection('users').findOne({ email: (token.email as string).toLowerCase() });
          if (doc) token.userId = doc._id.toString();
        } catch {}
      }
      const email = (token.email || user?.email || '').toLowerCase();
      token.isAdmin = ADMIN_EMAILS.includes(email);
      return token;
    },
    async session({ session, token }: { session: import('next-auth').Session; token: import('next-auth/jwt').JWT }) {
      if (session.user && token.userId) {
        (session.user as Record<string, unknown>).id = token.userId;
      }
      (session as unknown as Record<string, unknown>).isAdmin = !!token.isAdmin;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
