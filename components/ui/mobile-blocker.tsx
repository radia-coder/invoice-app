'use client';

import { useEffect, useState } from 'react';

export function MobileBlocker({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /mobile|iphone|ipod|android.*mobile|windows phone|blackberry|bb10/i.test(userAgent);
      const isTablet = /ipad|tablet|playbook|silk/i.test(userAgent);
      const isSmallScreen = window.innerWidth < 1024;

      setIsMobile((isMobileDevice || isTablet) && isSmallScreen);
      setIsChecking(false);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  if (isMobile) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-start justify-center pt-32">
        <div className="text-center">
          <svg
            className="w-24 h-24 mx-auto text-purple-500 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <h1 className="text-2xl font-bold text-white">
            Desktop Only
          </h1>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
