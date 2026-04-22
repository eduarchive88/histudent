"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, Settings2 } from "lucide-react";

export default function AdminTabs() {
  const pathname = usePathname();
  const isSettings = pathname === "/admin/settings";

  return (
    <div className="flex gap-2">
      <Link
        href="/admin"
        className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition ${
          !isSettings ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
      >
        <BellRing className="w-4 h-4 inline mr-1.5 -mt-0.5" />
        실시간 호출
      </Link>
      <Link
        href="/admin/settings"
        className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition ${
          isSettings ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
      >
        <Settings2 className="w-4 h-4 inline mr-1.5 -mt-0.5" />
        설정
      </Link>
    </div>
  );
}
