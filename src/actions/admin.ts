"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { read, utils } from "xlsx";

export async function uploadStudentsFromExcel(
  _prev: { error?: string; count?: number } | null,
  formData: FormData
): Promise<{ error?: string; count?: number }> {
  try {
    const file = formData.get("excel") as File | null;
    if (!file || file.size === 0) return { error: "파일을 선택해주세요." };

    const bytes = await file.arrayBuffer();
    const workbook = read(bytes);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = utils.sheet_to_json<Record<string, unknown>>(worksheet);

    if (jsonData.length === 0) return { error: "데이터를 찾지 못했습니다. 헤더(학년/반/번호/이름)를 확인하세요." };

    // 실제 헤더 목록 — 이름 컬럼 못 찾을 때 진단용
    const detectedHeaders = Object.keys(jsonData[0]).join(", ");

    const getVal = (row: Record<string, unknown>, keys: string[]) => {
      const key = Object.keys(row).find((k) =>
        keys.some((pk) => k.replace(/\s/g, "").toLowerCase().includes(pk.replace(/\s/g, "").toLowerCase()))
      );
      return key ? row[key] : null;
    };

    const students = jsonData.map((row) => {
      const grade     = parseInt(String(getVal(row, ["학년", "grade", "년"]) ?? "1")) || 1;
      const cls       = parseInt(String(getVal(row, ["반", "class", "학급", "班"]) ?? "1")) || 1;
      const number    = parseInt(String(getVal(row, ["번호", "num", "number", "출석", "No", "no"]) ?? "1")) || 1;
      const name      = String(getVal(row, ["이름", "성명", "학생명", "name", "성 명", "학생 이름"]) ?? "");
      const studentId = `${grade}${String(cls).padStart(2, "0")}${String(number).padStart(2, "0")}`;
      return { grade, class: cls, number, name, studentId };
    });

    const noNames = students.every((s) => !s.name);
    if (noNames) {
      return { error: `이름 열을 찾지 못했습니다. 파일의 헤더: [${detectedHeaders}] — 이름/성명/학생명 중 하나가 있어야 합니다.` };
    }

    const finalStudents = students.map((s) => ({ ...s, name: s.name || "이름없음" }));

    await prisma.student.deleteMany();
    await prisma.student.createMany({ data: finalStudents, skipDuplicates: true });
    revalidatePath("/admin/settings");
    return { count: students.length };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "알 수 없는 오류" };
  }
}

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
