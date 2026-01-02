'use client';

import type { FormEvent, FormHTMLAttributes, ReactNode } from 'react';
import { useRef } from 'react';

interface AutoSubmitFormProps extends FormHTMLAttributes<HTMLFormElement> {
  children: ReactNode;
}

export default function AutoSubmitForm({ children, onChange, ...props }: AutoSubmitFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const handleChange = (event: FormEvent<HTMLFormElement>) => {
    if (onChange) {
      onChange(event);
    }

    const target = event.target as HTMLElement | null;
    if (target && target.closest('[data-auto-submit="ignore"]')) {
      return;
    }

    const form = formRef.current;
    if (!form) return;

    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
      return;
    }

    form.submit();
  };

  return (
    <form ref={formRef} onChange={handleChange} {...props}>
      {children}
    </form>
  );
}
