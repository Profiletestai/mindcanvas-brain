import Image from "next/image";
import logo from "@/public/images/profile-test-ai-logo.png";
import { SubStepper } from "./SubStepper";

export function SubHeader() {
  return (
    <header>
      <div className="w-full bg-white h-[105px] flex items-center justify-center">
        <Image
          src={logo}
          alt="profiletest.ai"
          width={222}
          height={68}
          priority
          className="h-[68px] w-auto select-none"
        />
      </div>
      <div
        className="w-full h-[62px]"
        style={{ background: "rgb(239,245,254)" }}
      >
        <div className="h-full mx-auto flex items-center gap-4 px-7 max-w-[1440px]">
          <SubStepper />
        </div>
      </div>
    </header>
  );
}
