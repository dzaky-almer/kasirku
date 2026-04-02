import NextAuth from "next-auth";
<<<<<<< HEAD
import CredentialsProvider from "next-auth/providers/credentials";
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

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    storeId?: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    CredentialsProvider({
=======
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
>>>>>>> 936b7f6194c71e0bc301cad41692b6e6d10db08a
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
<<<<<<< HEAD
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
=======
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { stores: true },
>>>>>>> 936b7f6194c71e0bc301cad41692b6e6d10db08a
        });

        if (!user) return null;

<<<<<<< HEAD
        const isValid = await bcrypt.compare(
=======
        const valid = await bcrypt.compare(
>>>>>>> 936b7f6194c71e0bc301cad41692b6e6d10db08a
          credentials.password as string,
          user.password
        );

<<<<<<< HEAD
        if (!isValid) return null;
=======
        if (!valid) return null;
>>>>>>> 936b7f6194c71e0bc301cad41692b6e6d10db08a

        return {
          id: user.id,
          email: user.email,
<<<<<<< HEAD
          name: user.email,
=======
          storeId: user.stores[0]?.id ?? null,
>>>>>>> 936b7f6194c71e0bc301cad41692b6e6d10db08a
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
<<<<<<< HEAD
        // Ambil storeId dari DB saat pertama login
        const store = await prisma.store.findFirst({
          where: { userId: user.id },
        });
        token.storeId = store?.id;
=======
        token.storeId = (user as any).storeId;
>>>>>>> 936b7f6194c71e0bc301cad41692b6e6d10db08a
      }
      return token;
    },
    async session({ session, token }) {
<<<<<<< HEAD
      session.user.id = token.id as string;
      session.user.storeId = token.storeId;
=======
      if (token) {
        session.user.id = token.id as string;
        (session.user as any).storeId = token.storeId;
      }
>>>>>>> 936b7f6194c71e0bc301cad41692b6e6d10db08a
      return session;
    },
  },
  pages: {
<<<<<<< HEAD
    signIn: "/login", // sesuaikan dengan halaman login kamu
=======
    signIn: "/login",
>>>>>>> 936b7f6194c71e0bc301cad41692b6e6d10db08a
  },
  session: {
    strategy: "jwt",
  },
});