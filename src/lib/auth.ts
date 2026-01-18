import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyUser, getUserByEmail } from "./dataStore";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await verifyUser(email, password);
        
        if (!user) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.email = user.email as string;
        token.name = user.name as string;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.name = token.name;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  trustHost: true,
});

// Helper to get current user from session
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = getUserByEmail(session.user.email);
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}

// Helper to require auth - throws if not authenticated
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
