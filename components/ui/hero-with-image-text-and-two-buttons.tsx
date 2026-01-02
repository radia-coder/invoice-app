import { MoveRight, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import Image from "next/image";

function Hero() {
  return (
    <div className="w-full py-20 lg:py-40">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 gap-8 items-center lg:grid-cols-2">
          <div className="flex gap-4 flex-col">
            <div>
              <Badge variant="outline">We&apos;re live!</Badge>
            </div>
            <div className="flex gap-4 flex-col">
              <h1 className="text-5xl md:text-7xl max-w-lg tracking-tighter text-left font-regular">
                This is the start of something!
              </h1>
              <p className="text-xl leading-relaxed tracking-tight text-muted-foreground max-w-md text-left">
                Managing a small business today is already tough. Avoid further
                complications by ditching outdated, tedious trade methods. Our
                goal is to streamline SMB trade, making it easier and faster than
                ever.
              </p>
            </div>
            <div className="flex flex-row gap-4">
              <Button size="lg" className="gap-4" variant="outline" asChild>
                <Link href="https://unsplash.com/photos/a-man-sitting-at-a-desk-with-a-laptop-and-a-cup-of-coffee-744oGZ8TS_0" target="_blank">
                  Jump on a call <PhoneCall className="w-4 h-4" />
                </Link>
              </Button>
              <Button size="lg" className="gap-4" asChild>
                <Link href="/login">
                  Sign up here <MoveRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="bg-muted rounded-md aspect-square overflow-hidden relative">
            <Image 
              src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=1000&auto=format&fit=crop" 
              alt="Invoice Management" 
              fill
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export { Hero };
