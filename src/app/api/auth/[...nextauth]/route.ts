import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

// Exporting both GET and POST as required by NextAuth.js for standard authentication routes
export { handler as GET, handler as POST };
