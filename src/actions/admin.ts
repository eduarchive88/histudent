"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getStudents() {
  return await prisma.student.findMany({
    orderBy: [
      { grade: "asc" },
      { class: "asc" },
      { number: "asc" },
    ],
  });
}

export async function bulkInsertStudents(
  students: {
    grade: number;
    class: number;
    number: number;
    name: string;
    studentId: string;
  }[],
  clearExisting: boolean
) {
  try {
    if (clearExisting) {
      await prisma.student.deleteMany();
    }
    
    // UPSERT or Ignore is better in case of duplicate studentIds, 
    // but Prisma createMany with skipDuplicates handles duplicate studentId nicely.
    await prisma.student.createMany({
      data: students,
      skipDuplicates: true,
    });
    
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getLocations() {
  return await prisma.location.findMany({
    orderBy: { name: "asc" },
  });
}

export async function addLocation(name: string) {
  try {
    if (!name.trim()) return { success: false, error: "장소 이름을 입력해주세요." };
    await prisma.location.create({
      data: { name: name.trim() },
    });
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteLocation(id: number) {
  try {
    await prisma.location.delete({
      where: { id },
    });
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function logCallHistory(data: {
  studentId: string;
  studentName: string;
  reason: string;
  locationName: string;
  sessionCode: string;
}) {
  try {
    await prisma.callHistory.create({
      data,
    });
    return { success: true };
  } catch (error: any) {
    console.error("Failed to log call history:", error);
    return { success: false, error: error.message };
  }
}
