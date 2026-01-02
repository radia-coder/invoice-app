import React from "react";
import { cn } from "@/lib/utils";

type AppContainerProps = React.HTMLAttributes<HTMLDivElement>;

export default function AppContainer({ className, ...props }: AppContainerProps) {
  return (
    <div
      className={cn("w-full max-w-[1200px] mx-auto px-6", className)}
      {...props}
    />
  );
}
