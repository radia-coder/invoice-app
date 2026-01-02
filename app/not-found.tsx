import Link from 'next/link';
import NotFoundIllustration from '@/components/NotFoundIllustration';

function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M7 5l5 5-5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function NotFound() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center -translate-y-14">
        <NotFoundIllustration />
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white md:text-5xl">
          Page Not Found
        </h1>
        <p className="mt-3 text-sm text-zinc-400 md:text-base">
          <span className="block">We couldn&apos;t find the page you were looking for. Check</span>
          <span className="block">the URL to make sure it&apos;s correct and try again.</span>
        </p>
        <div className="mt-7 flex flex-col items-center gap-3 text-sm font-medium text-blue-500 sm:flex-row sm:gap-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 hover:underline"
          >
            Back to homepage
            <ArrowRightIcon />
          </Link>
          <a
            href="https://mail.google.com/mail/u/0/#inbox"
            className="inline-flex items-center gap-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Support
            <ArrowRightIcon />
          </a>
        </div>
      </div>
    </main>
  );
}
