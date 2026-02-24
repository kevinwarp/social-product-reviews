import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        // Attach role from database
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        (session.user as unknown as Record<string, unknown>).role = dbUser?.role ?? "USER";
      }
      return session;
    },
    async signIn({ user }) {
      // Update lastLoginAt on sign-in (may not exist yet on first login)
      if (user.id) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
          await prisma.eventLog.create({
            data: {
              userId: user.id,
              eventType: "LOGIN",
              metadata: {},
            },
          });
        } catch {
          // First-time user — record doesn't exist yet, adapter will create it
        }
      }
      return true;
    },
  },
  pages: {
    signIn: "/",
  },
});
