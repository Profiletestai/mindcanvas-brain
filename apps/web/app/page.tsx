import Link from "next/link";
import { PublicPageShell } from "@/components/public/ProfiletestChrome";

export default function LandingPage() {
  return (
    <PublicPageShell>
      <section className="relative flex flex-1 overflow-hidden border-y border-white/[0.035] bg-[#050b13]">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 opacity-[0.055]" style={{ backgroundImage: "linear-gradient(to right, #9ec8e0 1px, transparent 1px), linear-gradient(to bottom, #9ec8e0 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
          <div className="absolute inset-y-0 right-0 w-3/5 bg-[radial-gradient(circle_at_58%_42%,rgba(49,137,184,0.22),transparent_38%)]" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#03070d] to-transparent" />
        </div>

        <div className="relative mx-auto grid w-full max-w-[1440px] items-center gap-14 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:px-[72px] lg:py-14">
          <div className="relative z-10 max-w-[650px]">
            <div className="flex items-center gap-3 text-[12.5px] font-semibold uppercase tracking-[2px] text-[#4FA8D8]"><span>Behavioural profiling</span><span className="h-px w-9 bg-[#2f799f]" /></div>
            <h1 className="mt-6 text-[44px] font-extrabold leading-[1.06] tracking-[-0.035em] text-[#F2F5F8] sm:text-[56px] sm:leading-[59px]">Know them<br />before the call.</h1>
            <p className="mt-6 max-w-[610px] text-[15px] leading-[25px] text-[#9AA7BA] sm:text-[17px] sm:leading-[27.2px]">
              Send one short diagnostic before the conversation.<br className="hidden sm:block" /> They get a personal report worth keeping. You get Insider Insights<br className="hidden xl:block" /> into how they think, decide and buy.
            </p>
            <div className="mt-9">
              <Link href="/onboarding/v2" className="inline-flex min-h-[50px] items-center justify-center rounded-[9px] bg-white px-7 text-[14.5px] font-bold text-[#136498] shadow-[0_8px_26px_rgba(79,168,216,0.2)] transition hover:-translate-y-0.5">Start with 3 free tests</Link>
              <p className="mt-3 text-[13px] text-[#6B7686]"><span className="mr-1.5 font-extrabold text-[#5FE3B3]">✓</span>No card required.</p>
            </div>
          </div>

          <div className="relative mx-auto hidden h-[510px] w-full max-w-[650px] lg:block" aria-label="One diagnostic creates a personal report and Insider Insights">
            <div className="absolute left-[20%] top-[2%] flex h-[320px] w-[320px] items-center justify-center rounded-full border border-white/[0.03] bg-[radial-gradient(circle_at_44%_22%,#536f83_0%,#163c55_24%,#06253b_54%,#031521_77%)] shadow-[inset_0_0_70px_rgba(2,9,15,0.68),0_35px_90px_rgba(0,0,0,0.35)]">
              <div className="max-w-[220px] text-center"><p className="text-[27px] font-extrabold leading-[37px] text-[#F2F5F8]">One diagnostic,<br />two useful reads</p><p className="mt-8 text-[18px] font-medium tracking-wide text-white/45">profiletest.ai<sup className="text-[7px]">®</sup></p></div>
            </div>
            <div className="absolute left-[45%] top-[57%] h-px w-[105px] origin-left -rotate-[58deg] bg-gradient-to-r from-[#28769d]/70 to-transparent" />
            <div className="absolute left-[54%] top-[57%] h-px w-[105px] origin-left rotate-[56deg] bg-gradient-to-r from-[#28769d]/70 to-transparent" />
            <div className="absolute bottom-[2%] left-[7%] flex h-[190px] w-[190px] items-center justify-center rounded-full border border-[#2e7395]/35 bg-[radial-gradient(circle_at_45%_25%,#2d779d_0%,#0d4a6e_42%,#062b43_78%)] shadow-[inset_0_0_35px_rgba(3,16,25,0.4)]"><span className="text-center text-[15px] font-extrabold leading-[19px] text-[#F2F5F8]">Personal<br />report</span></div>
            <div className="absolute bottom-[5%] right-[1%] flex h-[190px] w-[190px] items-center justify-center rounded-full border border-white/[0.04] bg-[radial-gradient(circle_at_45%_22%,#476b82_0%,#153d56_43%,#08263a_78%)] shadow-[inset_0_0_40px_rgba(3,16,25,0.5)]"><span className="text-center text-[15px] font-extrabold leading-[19px] text-[#F2F5F8]">Insider<br />insights</span></div>
          </div>

          <div className="relative mx-auto grid w-full max-w-[520px] grid-cols-2 gap-4 lg:hidden">
            <div className="col-span-2 mx-auto flex aspect-square w-[70%] items-center justify-center rounded-full bg-[radial-gradient(circle_at_44%_22%,#536f83_0%,#163c55_28%,#031521_78%)] p-8 text-center text-xl font-extrabold">One diagnostic,<br /> two useful reads</div>
            <div className="flex aspect-square items-center justify-center rounded-full bg-[#0d4a6e] text-center text-sm font-bold">Personal report</div>
            <div className="flex aspect-square items-center justify-center rounded-full bg-[#153d56] text-center text-sm font-bold">Insider insights</div>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}

