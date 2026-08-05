import Image from "next/image";
import logo from "@/public/images/profile-test-ai-logo.png";
import { Stepper } from "./Stepper";

export function OnboardingHeader() {
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
      <Stepper />
    </header>
  );
}
