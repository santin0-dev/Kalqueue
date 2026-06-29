import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { UserRole } from "@prisma/client";

const DEFAULT_DOCTOR_INVITE_CODE = "doctor-invite-2024";
const DEFAULT_ADMIN_INVITE_CODE = "admin-invite-2024";

function getInviteCode(envValue: string | undefined, fallback: string) {
  const normalized = envValue?.trim().replace(/^"|"$/g, "");
  return normalized || fallback;
}

function getRegisterError(err: unknown) {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: string }).code;

    if (code === "P2002") {
      return { message: "Email already registered", status: 409 };
    }

    if (code === "P2022") {
      return {
        message:
          "Database schema is out of date. Run `npx prisma db push`, then redeploy.",
        status: 500,
      };
    }
  }

  if (err instanceof Error && err.message.includes("Invalid Date")) {
    return { message: "Please enter a valid date of birth", status: 400 };
  }

  return { message: "Registration failed. Please check the server logs.", status: 500 };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const { fieldErrors, formErrors } = parsed.error.flatten();
      return NextResponse.json(
        { error: fieldErrors, formErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const doctorInviteCode = getInviteCode(
      process.env.DOCTOR_INVITE_CODE,
      DEFAULT_DOCTOR_INVITE_CODE
    );
    const adminInviteCode = getInviteCode(
      process.env.ADMIN_INVITE_CODE,
      DEFAULT_ADMIN_INVITE_CODE
    );

    if (data.role === "DOCTOR" && data.inviteCode !== doctorInviteCode) {
      return NextResponse.json({ error: "Invalid doctor invite code" }, { status: 403 });
    }

    if (data.role === "ADMIN" && data.inviteCode !== adminInviteCode) {
      return NextResponse.json({ error: "Invalid admin invite code" }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          role: data.role as UserRole,
        },
      });

      if (data.role === "PATIENT") {
        await tx.patient.create({
          data: {
            userId: newUser.id,
            firstName: data.firstName,
            lastName: data.lastName,
            dateOfBirth: new Date(data.dateOfBirth!),
            phone: data.phone!,
            address: data.address!,
            category: data.category ?? "REGULAR",
          },
        });
      } else if (data.role === "DOCTOR") {
        await tx.doctor.create({
          data: {
            userId: newUser.id,
            firstName: data.firstName,
            lastName: data.lastName,
            specialty: data.specialty!,
            licenseNumber: data.licenseNumber!,
            phone: data.phone!,
          },
        });
      } else if (data.role === "ADMIN") {
        await tx.admin.create({
          data: {
            userId: newUser.id,
            firstName: data.firstName,
            lastName: data.lastName,
          },
        });
      }

      return newUser;
    });

    return NextResponse.json(
      { id: user.id, email: user.email, role: user.role },
      { status: 201 }
    );
  } catch (err) {
    console.error("Register error:", err);
    const { message, status } = getRegisterError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
