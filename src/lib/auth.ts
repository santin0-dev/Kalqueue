import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: UserRole;
      firstName: string;
      lastName: string;
      clinicId?: string | null;
      patientId?: string | null;
      doctorId?: string | null;
      adminId?: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    role: UserRole;
    firstName: string;
    lastName: string;
    clinicId?: string | null;
    patientId?: string | null;
    doctorId?: string | null;
    adminId?: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    firstName: string;
    lastName: string;
    clinicId?: string | null;
    patientId?: string | null;
    doctorId?: string | null;
    adminId?: string | null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            patient: true,
            doctor: {
              include: {
                clinicAssignments: {
                  where: { isActive: true },
                  take: 1,
                },
              },
            },
            admin: true,
          },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        let firstName = "";
        let lastName = "";
        let clinicId: string | null = null;
        let patientId: string | null = null;
        let doctorId: string | null = null;
        let adminId: string | null = null;

        if (user.patient) {
          firstName = user.patient.firstName;
          lastName = user.patient.lastName;
          patientId = user.patient.id;
        } else if (user.doctor) {
          firstName = user.doctor.firstName;
          lastName = user.doctor.lastName;
          doctorId = user.doctor.id;
          clinicId = user.doctor.clinicAssignments[0]?.clinicId ?? null;
        } else if (user.admin) {
          firstName = user.admin.firstName;
          lastName = user.admin.lastName;
          adminId = user.admin.id;
          clinicId = user.admin.clinicId;
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName,
          lastName,
          clinicId,
          patientId,
          doctorId,
          adminId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.clinicId = user.clinicId;
        token.patientId = user.patientId;
        token.doctorId = user.doctorId;
        token.adminId = user.adminId;
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id,
          email: session.user.email ?? "",
          role: token.role,
          firstName: token.firstName,
          lastName: token.lastName,
          clinicId: token.clinicId,
          patientId: token.patientId,
          doctorId: token.doctorId,
          adminId: token.adminId,
        },
      };
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
