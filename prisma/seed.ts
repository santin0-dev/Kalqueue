import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding KalQueue database...");

  const clinic = await prisma.clinic.upsert({
    where: { id: "seed-clinic-1" },
    update: {},
    create: {
      id: "seed-clinic-1",
      name: "KalQueue Community Health Center",
      address: "123 Rizal Avenue, Quezon City, Metro Manila",
      phone: "+639171234567",
      type: "COMMUNITY",
    },
  });

  const deptGeneral = await prisma.department.upsert({
    where: { id: "seed-dept-general" },
    update: {},
    create: {
      id: "seed-dept-general",
      clinicId: clinic.id,
      name: "General Medicine",
      floor: "2nd Floor",
      building: "Main Building",
      roomNumber: "201",
      navigationInstructions: "Take the stairs near the entrance, turn left at the nurses station.",
    },
  });

  const deptPediatrics = await prisma.department.upsert({
    where: { id: "seed-dept-pedia" },
    update: {},
    create: {
      id: "seed-dept-pedia",
      clinicId: clinic.id,
      name: "Pediatrics",
      floor: "3rd Floor",
      building: "Main Building",
      roomNumber: "305",
      navigationInstructions: "Elevator to 3rd floor, follow the colorful hallway signs.",
    },
  });

  await prisma.clinicCapacityConfig.upsert({
    where: { clinicId: clinic.id },
    update: {},
    create: {
      clinicId: clinic.id,
      appointmentRatio: 0.6,
      walkinRatio: 0.4,
      blockSize: 10,
      maxDailyWalkins: 50,
    },
  });

  const passwordHash = await bcrypt.hash("password123", 12);

  const patientUser = await prisma.user.upsert({
    where: { email: "patient@kalqueue.ph" },
    update: {},
    create: {
      email: "patient@kalqueue.ph",
      passwordHash,
      role: "PATIENT",
      patient: {
        create: {
          firstName: "Maria",
          lastName: "Santos",
          dateOfBirth: new Date("1985-03-15"),
          phone: "+639171111111",
          address: "456 Mabini St, Quezon City",
          category: "REGULAR",
          languagePreference: "tl",
        },
      },
    },
    include: { patient: true },
  });

  const hmoUser = await prisma.user.upsert({
    where: { email: "hmo@kalqueue.ph" },
    update: {},
    create: {
      email: "hmo@kalqueue.ph",
      passwordHash,
      role: "PATIENT",
      patient: {
        create: {
          firstName: "Juan",
          lastName: "Reyes",
          dateOfBirth: new Date("1978-07-22"),
          phone: "+639172222222",
          address: "789 Luna St, Manila",
          category: "HMO",
          languagePreference: "en",
          hmoProvider: "Maxicare",
          hmoMemberNumber: "MXC-123456",
        },
      },
    },
  });

  const doctorUser = await prisma.user.upsert({
    where: { email: "doctor@kalqueue.ph" },
    update: {},
    create: {
      email: "doctor@kalqueue.ph",
      passwordHash,
      role: "DOCTOR",
      doctor: {
        create: {
          firstName: "Ana",
          lastName: "Cruz",
          specialty: "General Medicine",
          licenseNumber: "PRC-123456",
          phone: "+639173333333",
        },
      },
    },
    include: { doctor: true },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@kalqueue.ph" },
    update: {},
    create: {
      email: "admin@kalqueue.ph",
      passwordHash,
      role: "ADMIN",
      admin: {
        create: {
          firstName: "Roberto",
          lastName: "Garcia",
          clinicId: clinic.id,
        },
      },
    },
  });

  if (doctorUser.doctor) {
    await prisma.doctorClinicAssignment.upsert({
      where: {
        doctorId_clinicId_departmentId: {
          doctorId: doctorUser.doctor.id,
          clinicId: clinic.id,
          departmentId: deptGeneral.id,
        },
      },
      update: { isActive: true },
      create: {
        doctorId: doctorUser.doctor.id,
        clinicId: clinic.id,
        departmentId: deptGeneral.id,
        isActive: true,
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.availabilityWindow.create({
      data: {
        doctorId: doctorUser.doctor.id,
        clinicId: clinic.id,
        departmentId: deptGeneral.id,
        date: today,
        startTime: "08:00",
        endTime: "17:00",
        status: "ACTIVE",
      },
    });
  }

  await prisma.announcement.create({
    data: {
      adminId: (await prisma.admin.findFirst({ where: { userId: adminUser.id } }))!.id,
      title: "Welcome to KalQueue",
      body: "Our new queue management system is now live. Please register at the front desk if you need assistance.",
      isActive: true,
    },
  });

  console.log("Seed complete!");
  console.log("");
  console.log("Demo accounts (password: password123):");
  console.log("  Patient:  patient@kalqueue.ph");
  console.log("  HMO:      hmo@kalqueue.ph");
  console.log("  Doctor:   doctor@kalqueue.ph");
  console.log("  Admin:    admin@kalqueue.ph");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
