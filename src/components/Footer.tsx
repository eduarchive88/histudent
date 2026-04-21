import Link from "next/link";
import React from "react";

const Footer = () => {
  return (
    <footer className="w-full bg-slate-100 text-slate-500 py-6 mt-auto border-t border-slate-200">
      <div className="max-w-4xl mx-auto px-4 text-center md:text-sm text-xs space-y-2">
        <p className="font-medium text-slate-600">만든 사람: 경기도 지구과학 교사 뀨짱</p>
        <div className="flex justify-center items-center gap-4 text-slate-500">
          <Link
            href="https://open.kakao.com/o/s7hVU65h"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-500 transition-colors"
          >
            문의: 카카오톡 오픈채팅
          </Link>
          <span className="text-slate-300">|</span>
          <Link
            href="https://eduarchive.tistory.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-500 transition-colors"
          >
            블로그: 뀨짱쌤의 교육자료 아카이브
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
