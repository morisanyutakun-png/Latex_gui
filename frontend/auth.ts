import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const isAuthConfigured = !!(
  process.env.AUTH_SECRET &&
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET
);

const authConfig = NextAuth({
  providers: isAuthConfigured
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      ]
    : [],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
});

export const { handlers, signIn, signOut, auth } = authConfig;
export { isAuthConfigured };
