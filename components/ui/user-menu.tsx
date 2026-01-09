'use client';

import React from 'react';
import Image from 'next/image';

interface UserMenuProps {
  name: string;
  email: string;
}

export function UserMenu({ name, email }: UserMenuProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-8 h-8 rounded-full overflow-hidden border border-zinc-700 bg-zinc-800">
        <Image
          src="/LogoInvoice.png"
          alt={name}
          fill
          className="object-cover"
          priority
        />
      </div>
      <span className="text-sm text-zinc-300 font-medium hidden md:block">
        {name}
      </span>
    </div>
  );
}
