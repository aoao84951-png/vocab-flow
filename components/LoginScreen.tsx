"use client";

import { FormEvent, useState } from "react";

type LoginScreenProps = {
  onPreviewContinue?: () => void;
};

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.73 12.43c-.02-2.1 1.72-3.12 1.8-3.17a3.86 3.86 0 0 0-3.04-1.65c-1.28-.14-2.52.77-3.17.77-.67 0-1.68-.76-2.77-.73a4.1 4.1 0 0 0-3.45 2.1c-1.49 2.58-.38 6.37 1.05 8.45.72 1.01 1.55 2.14 2.64 2.1 1.06-.04 1.46-.68 2.74-.68 1.27 0 1.65.68 2.76.65 1.14-.02 1.86-1.01 2.55-2.03a8.42 8.42 0 0 0 1.17-2.38 3.66 3.66 0 0 1-2.28-3.43ZM14.65 6.25a3.72 3.72 0 0 0 .85-2.66 3.8 3.8 0 0 0-2.46 1.26 3.55 3.55 0 0 0-.88 2.56 3.14 3.14 0 0 0 2.49-1.16Z"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.83-1.76-5.62-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.38 13.86A6 6 0 0 1 6.06 12c0-.65.11-1.28.32-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.38 3.13 1.04 4.48l3.34-2.62Z" />
      <path fill="#EA4335" d="M12 6.01c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.34 2.62C7.17 7.77 9.39 6.01 12 6.01Z" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2.6 12s3.2-5 9.4-5 9.4 5 9.4 5-3.2 5-9.4 5-9.4-5-9.4-5Z" />
      <circle cx="12" cy="12" r="2.4" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m3 3 18 18" />
      <path d="M10.6 6.2A10.6 10.6 0 0 1 12 6c6.2 0 9.4 6 9.4 6a14.4 14.4 0 0 1-2.4 3.1M6.2 6.2C3.8 7.8 2.6 12 2.6 12s3.2 6 9.4 6c1.3 0 2.5-.3 3.5-.7" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

export default function LoginScreen({ onPreviewContinue }: LoginScreenProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const showPreviewNotice = () => {
    alert("현재는 로그인 화면 디자인 단계입니다. 다음 단계에서 실제 Supabase 로그인을 연결합니다.");
  };

  const submitPreview = (event: FormEvent) => {
    event.preventDefault();
    showPreviewNotice();
  };

  return (
    <main className="min-h-[100dvh] bg-[#f5f6f8] px-4 py-5 text-[#17191d] sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-40px)] w-full max-w-[1100px] items-center justify-center sm:min-h-[calc(100dvh-64px)]">
        <section className="grid w-full overflow-hidden rounded-[30px] border border-black/[0.055] bg-white shadow-[0_24px_80px_rgba(24,31,42,0.10)] lg:grid-cols-[1.03fr_0.97fr]">
          <div className="relative hidden min-h-[690px] overflow-hidden bg-[#15181e] p-14 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/[0.07] blur-2xl" />
            <div className="absolute -bottom-28 -left-20 h-96 w-96 rounded-full bg-[#7887ff]/20 blur-3xl" />

            <div className="relative z-10 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-[14px] bg-white text-[19px] font-black text-[#17191d] shadow-lg">
                V
              </div>
              <div>
                <p className="text-[17px] font-semibold tracking-[-0.02em]">ᴠᴏᴄᴀ</p>
                <p className="mt-0.5 text-xs text-white/45">Your personal vocabulary space</p>
              </div>
            </div>

            <div className="relative z-10 max-w-[430px] pb-7">
              <p className="mb-5 text-sm font-medium text-white/50">기억은 더 선명하게, 학습은 더 단순하게.</p>
              <h1 className="text-[48px] font-semibold leading-[1.12] tracking-[-0.055em]">
                나만의 단어를
                <br />
                가장 나다운 방식으로.
              </h1>
              <p className="mt-7 max-w-[390px] text-[15px] leading-7 text-white/55">
                단어, 뜻, 예문과 학습 포인트를 한곳에 정리하고 모든 기기에서 이어서 학습하세요.
              </p>
            </div>

            <div className="relative z-10 grid grid-cols-3 gap-3">
              {[
                ["01", "체계적인 정리"],
                ["02", "간편한 복습"],
                ["03", "기기 간 동기화"],
              ].map(([number, label]) => (
                <div key={number} className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-4 backdrop-blur-sm">
                  <p className="text-[11px] font-semibold text-white/35">{number}</p>
                  <p className="mt-2 text-[13px] font-medium text-white/80">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-h-[660px] items-center justify-center px-6 py-10 sm:px-12 lg:px-16">
            <div className="w-full max-w-[390px]">
              <div className="mb-9 lg:hidden">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#17191d] text-[17px] font-black text-white">V</div>
                  <div>
                    <p className="text-[16px] font-semibold tracking-[-0.02em]">ᴠᴏᴄᴀ</p>
                    <p className="mt-0.5 text-[11px] text-[#9aa0aa]">Your personal vocabulary space</p>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <p className="text-[13px] font-semibold text-[#8e95a0]">WELCOME</p>
                <h2 className="mt-2 text-[31px] font-semibold tracking-[-0.045em] text-[#17191d]">
                  {mode === "login" ? "다시 만나서 반가워요." : "새로운 학습을 시작해요."}
                </h2>
                <p className="mt-3 text-[14px] leading-6 text-[#818793]">
                  {mode === "login"
                    ? "계정에 로그인하고 저장된 단어장을 이어서 학습하세요."
                    : "회원가입 후 나만의 단어장을 모든 기기에서 이용할 수 있어요."}
                </p>
              </div>

              <div className="grid grid-cols-2 rounded-xl bg-[#f1f2f4] p-1">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`h-10 rounded-[9px] text-[13px] font-semibold transition ${
                    mode === "login" ? "bg-white text-[#17191d] shadow-sm" : "text-[#8b919c]"
                  }`}
                >
                  로그인
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`h-10 rounded-[9px] text-[13px] font-semibold transition ${
                    mode === "signup" ? "bg-white text-[#17191d] shadow-sm" : "text-[#8b919c]"
                  }`}
                >
                  회원가입
                </button>
              </div>

              <form onSubmit={submitPreview} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-[12px] font-semibold text-[#626873]">이메일</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                    className="h-[50px] w-full rounded-xl border border-[#dfe2e7] bg-white px-4 text-[14px] outline-none transition placeholder:text-[#b5bac2] focus:border-[#777f8c] focus:ring-4 focus:ring-black/[0.035]"
                  />
                </label>

                <label className="block">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[#626873]">비밀번호</span>
                    {mode === "login" && (
                      <button type="button" className="text-[11px] font-medium text-[#9298a2] hover:text-[#4f5560]">
                        비밀번호 찾기
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={mode === "signup" ? "8자 이상 입력해주세요" : "비밀번호를 입력해주세요"}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      className="h-[50px] w-full rounded-xl border border-[#dfe2e7] bg-white px-4 pr-12 text-[14px] outline-none transition placeholder:text-[#b5bac2] focus:border-[#777f8c] focus:ring-4 focus:ring-black/[0.035]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#a0a5ae] hover:bg-[#f4f5f6] hover:text-[#646a74]"
                      aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
                </label>

                <button
                  type="submit"
                  className="mt-2 h-[51px] w-full rounded-xl bg-[#17191d] text-[14px] font-semibold text-white shadow-[0_10px_24px_rgba(23,25,29,0.16)] transition hover:bg-[#252930] active:scale-[0.99]"
                >
                  {mode === "login" ? "로그인" : "계정 만들기"}
                </button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#e7e9ed]" />
                <span className="text-[11px] font-medium text-[#a1a6af]">또는</span>
                <div className="h-px flex-1 bg-[#e7e9ed]" />
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={showPreviewNotice}
                  className="flex h-[49px] w-full items-center justify-center gap-3 rounded-xl bg-black text-[13px] font-semibold text-white transition hover:bg-[#1c1c1e] active:scale-[0.99]"
                >
                  <AppleIcon />
                  Apple로 계속하기
                </button>
                <button
                  type="button"
                  onClick={showPreviewNotice}
                  className="flex h-[49px] w-full items-center justify-center gap-3 rounded-xl border border-[#dfe2e7] bg-white text-[13px] font-semibold text-[#363a42] transition hover:bg-[#fafafa] active:scale-[0.99]"
                >
                  <GoogleIcon />
                  Google로 계속하기
                </button>
              </div>

              <p className="mt-6 text-center text-[11px] leading-5 text-[#a0a5ae]">
                계속하면 <button type="button" className="underline underline-offset-2">이용약관</button> 및{" "}
                <button type="button" className="underline underline-offset-2">개인정보처리방침</button>에 동의하게 됩니다.
              </p>

              {onPreviewContinue && (
                <button
                  type="button"
                  onClick={onPreviewContinue}
                  className="mx-auto mt-7 block text-[12px] font-medium text-[#8e949e] underline decoration-[#c5c9cf] underline-offset-4 hover:text-[#555b65]"
                >
                  로그인 기능 연결 전, 기존 단어장 열기
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
