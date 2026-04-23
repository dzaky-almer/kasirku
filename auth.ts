import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      storeId?: string;
    };
  }
}

type AuthUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  storeId?: string | null;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { stores: true },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          storeId: user.stores[0]?.id ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const mutableToken = token as typeof token & {
        id?: string;
        storeId?: string | null;
      };
      if (user) {
        const authUser = user as AuthUser;
        mutableToken.id = authUser.id;
        mutableToken.name = authUser.name;
        mutableToken.storeId = authUser.storeId ?? null;
      }
      return mutableToken;
    },
    async session({ session, token }) {
      const sessionToken = token as typeof token & {
        id?: string;
        storeId?: string | null;
        name?: string | null;
      };
      if (token) {
        session.user.id = sessionToken.id as string;
        session.user.name = sessionToken.name ?? session.user.name;
        session.user.storeId = typeof sessionToken.storeId === "string" ? sessionToken.storeId : undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
