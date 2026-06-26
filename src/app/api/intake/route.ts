import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { intakeSchema, getDocumentChecklist } from "@/lib/validations";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = intakeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { chiefComplaint, patientId, languagePreference, notes } = parsed.data;

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const documentChecklist = getDocumentChecklist(chiefComplaint);

    const intakeForm = await prisma.intakeForm.create({
      data: {
        patientId,
        chiefComplaint,
        notes,
        documentChecklist,
        languageFlag: languagePreference ?? patient.languagePreference,
      },
    });

    return NextResponse.json(intakeForm, { status: 201 });
  } catch (err) {
    console.error("Intake error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
