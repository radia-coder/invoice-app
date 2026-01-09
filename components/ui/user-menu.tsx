'use client';

import React from 'react';

interface UserMenuProps {
  name: string;
  email: string;
}

export function UserMenu({ name, email }: UserMenuProps) {
  return (
    <div className="flex items-center">
      <div className="w-8 h-8 rounded-full overflow-hidden border border-zinc-700 bg-zinc-800 flex items-center justify-center">
        <img
          src="/LogoInvoice.png"
          alt={name}
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}
