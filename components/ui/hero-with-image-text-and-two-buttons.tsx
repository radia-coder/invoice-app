import { MoveRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function Hero() {
  return (
    <div className="w-full min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-1 gap-8 items-center lg:grid-cols-2 min-h-screen -translate-y-10 lg:-translate-y-16">
          <div className="order-1 lg:order-2 rounded-lg overflow-hidden relative mt-6 lg:mt-0 lg:-mt-10 w-full h-[520px] sm:h-[620px] md:h-[740px] lg:h-[860px] mx-auto">
            <img
              src="/hero.png"
              alt="Driver statement preview on laptop"
              className="h-full w-full object-contain"
              loading="eager"
            />
          </div>
          <div className="order-2 lg:order-1 flex gap-6 flex-col max-w-2xl -mt-8 md:-mt-10 items-center text-center mx-auto">
            <div className="flex gap-6 flex-col items-center text-center">
              <h1 className="text-2xl md:text-3xl lg:text-4xl max-w-xl tracking-tight text-center font-normal leading-tight">
                Generate Professional Driver Statements in Minutes
              </h1>
              <p className="text-xs md:text-sm leading-relaxed text-gray-400 max-w-lg text-center">
                A complete invoice and driver settlement tool for trucking operations. Keep all load details,
                deductions, and net pay in one place, with a simple edit → preview → download flow and invoice
                history for re-download anytime.
              </p>
            </div>
            <div className="flex flex-row gap-4 mt-4 justify-center">
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
