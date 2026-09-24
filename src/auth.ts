import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, staff } from "@/db/schema";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (!user?.passwordHash) return null;

        // Locked out after repeated failures — reject regardless of password,
        // without revealing that distinction to the caller.
        if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          await db
            .update(users)
            .set({
              failedLoginAttempts: attempts,
              lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
            })
            .where(eq(users.id, user.id));
          return null;
        }

        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await db
            .update(users)
            .set({ failedLoginAttempts: 0, lockedUntil: null })
            .where(eq(users.id, user.id));
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    // Quick sign-in for a shared, possibly offline school computer: pick a
    // name from a tile list and type a short PIN instead of an email and
    // password. Still resolves to one specific staff account (so every
    // action is attributed to a real person) — it's just a faster way in,
    // set up per-person in Settings.
    Credentials({
      id: "staff-pin",
      credentials: {
        staffId: { label: "Staff", type: "text" },
        pin: { label: "PIN", type: "password" },
      },
      authorize: async (credentials) => {
        const staffId = credentials?.staffId as string | undefined;
        const pin = credentials?.pin as string | undefined;
        if (!staffId || !pin) return null;

        const member = await db.query.staff.findFirst({
          where: eq(staff.id, staffId),
          with: { user: true },
        });
        if (!member?.pinHash) return null;

        if (member.user.lockedUntil && member.user.lockedUntil.getTime() > Date.now()) return null;

        const valid = await bcrypt.compare(pin, member.pinHash);
        if (!valid) {
          const attempts = member.user.failedLoginAttempts + 1;
          await db
            .update(users)
            .set({
              failedLoginAttempts: attempts,
              lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
            })
            .where(eq(users.id, member.user.id));
          return null;
        }

        if (member.user.failedLoginAttempts > 0 || member.user.lockedUntil) {
          await db
            .update(users)
            .set({ failedLoginAttempts: 0, lockedUntil: null })
            .where(eq(users.id, member.user.id));
        }

        return { id: member.user.id, email: member.user.email, name: member.user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});
