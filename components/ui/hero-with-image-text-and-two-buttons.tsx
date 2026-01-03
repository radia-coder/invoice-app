import { MoveRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

function Hero() {
  return (
    <div className="w-full min-h-screen bg-zinc-950 text-white flex items-center">
      <div className="container mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 gap-10 items-center lg:grid-cols-2 lg:gap-16">
          <div className="order-1 lg:order-2 flex w-full justify-center lg:justify-end">
            <div className="w-full max-w-[520px] md:max-w-[600px] lg:max-w-[560px]">
              <Image
                src="/hero.png"
                alt="Driver statement preview on laptop"
                width={1536}
                height={1024}
                className="h-auto w-full object-contain"
                priority
              />
            </div>
          </div>
          <div className="order-2 lg:order-1 flex gap-6 flex-col max-w-xl items-center text-center lg:items-start lg:text-left">
            <div className="flex gap-6 flex-col items-center text-center lg:items-start lg:text-left">
              <h1 className="text-2xl md:text-3xl lg:text-4xl max-w-xl tracking-tight text-center lg:text-left font-normal leading-tight">
                Generate Professional Driver Statements in Minutes
              </h1>
              <p className="text-xs md:text-sm leading-relaxed text-gray-400 max-w-lg text-center lg:text-left">
                A complete invoice and driver settlement tool for trucking operations. Keep all load details,
                deductions, and net pay in one place, with a simple edit → preview → download flow and invoice
                history for re-download anytime.
              </p>
            </div>
            <div className="flex flex-row gap-4 mt-4 justify-center lg:justify-start">
              <Button
                size="lg"
                className="gap-2 bg-transparent border border-[#7a67e7]/40 hover:bg-[#7a67e7]/10 text-[#7a67e7] px-6 py-6 text-base"
                variant="outline"
                asChild
              >
                <Link href="#">
                  Go our website
                </Link>
              </Button>
              <Button
                size="lg"
                className="gap-2 bg-[#7a67e7] text-white hover:bg-[#6b59d6] px-6 py-6 text-base"
                asChild
              >
                <Link href="/login">
                  Sign in here <MoveRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Hero };
