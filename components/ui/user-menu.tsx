'use client';

import React from 'react';

interface UserMenuProps {
  name: string;
  email: string;
}

export function UserMenu({ name, email }: UserMenuProps) {
  return (
    <div className="flex items-center">
      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-zinc-600 bg-zinc-800 flex items-center justify-center shadow-lg">
        <img
          src="/LogoInvoice.png"
          alt={name}
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}
