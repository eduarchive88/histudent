import { utils, write } from "xlsx";
import { NextResponse } from "next/server";

export async function GET() {
  const ws = utils.aoa_to_sheet([
    ["학년", "반", "번호", "이름"],
    [1, 1, 1, "홍길동"],
    [1, 1, 2, "김철수"],
    [1, 2, 1, "이영희"],
    [2, 1, 1, "박민준"],
  ]);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, "학생명단");
  const buf: Buffer = write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename*=UTF-8\'\'%ED%95%99%EC%83%9D%EB%AA%85%EB%8B%A8_%EC%96%91%EC%8B%9D.xlsx',
    },
  });
}
