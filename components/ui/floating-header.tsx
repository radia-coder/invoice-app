'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    FileText,
    PlusCircle,
    BarChart3,
    Building2,
    Users,
    MenuIcon,
    LogOut,
    Shield
} from 'lucide-react';
import { Sheet, SheetContent, SheetFooter } from '@/components/ui/sheet';
import { Button, buttonVariants } from '@/components/ui/button';
import { UserMenu } from '@/components/ui/user-menu';
import { cn } from '@/lib/utils';

interface FloatingHeaderProps {
    userEmail?: string;
    userRole?: string;
}

export function FloatingHeader({ userEmail, userRole }: FloatingHeaderProps) {
    const [open, setOpen] = React.useState(false);
    const [loggingOut, setLoggingOut] = React.useState(false);
    const router = useRouter();

    const isSuperAdmin = userRole === 'super_admin';

    const links = [
        { label: 'Dashboard', href: '/dashboard', icon: FileText },
        { label: 'New Invoice', href: '/create', icon: PlusCircle },
        { label: 'Reports', href: '/reports', icon: BarChart3 },
        { label: 'Company', href: '/company', icon: Building2 },
        { label: 'Drivers', href: '/drivers', icon: Users },
        ...(isSuperAdmin ? [{ label: 'Sessions', href: '/sessions', icon: Shield }] : []),
    ];

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
            router.refresh();
        } finally {
            setLoggingOut(false);
        }
    };

    return (
        <header
            className={cn(
                'sticky top-4 z-50',
                'w-full rounded-xl border border-zinc-800 shadow-lg',
                'bg-zinc-900/95 supports-[backdrop-filter]:bg-zinc-900/80 backdrop-blur-lg'
            )}
        >
            <nav className="mx-auto flex items-center justify-between p-2 px-4 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center">
                {/* Logo */}
                <Link
                    href="/"
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-zinc-800 lg:justify-self-center"
                >
                    <div className="flex items-center justify-center w-10 h-10">
                        <img
                            src="/logo.png"
                            alt="InvoiceSystem logo"
                            className="h-10 w-10 rounded-md object-contain scale-[2.4] origin-center"
                            loading="eager"
                        />
                    </div>
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden lg:flex items-center gap-1 lg:justify-self-center">
                    {links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                buttonVariants({ variant: 'ghost', size: 'sm' }),
                                'text-zinc-400 hover:text-white hover:bg-zinc-800'
                            )}
                        >
                            <link.icon className="size-4 mr-1.5" />
                            {link.label}
                        </Link>
                    ))}
                </div>

                {/* Right Side */}
                <div className="flex items-center gap-2 lg:justify-self-end">
                    {userEmail && (
                        <UserMenu name="User" email={userEmail} />
                    )}

                    {/* Desktop Logout */}
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="hidden lg:flex text-zinc-400 hover:text-white hover:bg-zinc-800"
                    >
                        <LogOut className="size-4 mr-1.5" />
                        {loggingOut ? 'Signing out...' : 'Sign out'}
                    </Button>

                    {/* Mobile Menu */}
                    <Sheet open={open} onOpenChange={setOpen}>
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setOpen(!open)}
                            className="lg:hidden text-zinc-400 hover:text-white hover:bg-zinc-800"
                        >
                            <MenuIcon className="size-5" />
                        </Button>
                        <SheetContent
                            className="bg-zinc-900/98 supports-[backdrop-filter]:bg-zinc-900/95 backdrop-blur-lg border-zinc-800"
                            showClose={true}
                            side="left"
                        >
                            {/* Mobile Header */}
                            <div className="flex items-center gap-3 px-4 pt-6 pb-4 border-b border-zinc-800">
                                <div className="flex items-center justify-center w-10 h-10">
                                    <img
                                        src="/logo.png"
                                        alt="InvoiceSystem logo"
                                        className="h-10 w-10 rounded-lg object-contain scale-[2.4] origin-center"
                                        loading="eager"
                                    />
                                </div>
                                {userEmail && (
                                    <UserMenu name="User" email={userEmail} />
                                )}
                            </div>

                            {/* Mobile Navigation Links */}
                            <div className="grid gap-1 px-2 pt-4 pb-5">
                                {links.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setOpen(false)}
                                        className={cn(
                                            buttonVariants({ variant: 'ghost' }),
                                            'justify-start text-zinc-300 hover:text-white hover:bg-zinc-800 h-12'
                                        )}
                                    >
                                        <link.icon className="size-5 mr-3" />
                                        {link.label}
                                    </Link>
                                ))}
                            </div>

                            {/* Mobile Footer */}
                            <SheetFooter className="border-zinc-800 bg-zinc-900/50">
                                <Button
                                    variant="outline"
                                    onClick={handleLogout}
                                    disabled={loggingOut}
                                    className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                                >
                                    <LogOut className="size-4 mr-2" />
                                    {loggingOut ? 'Signing out...' : 'Sign out'}
                                </Button>
                            </SheetFooter>
                        </SheetContent>
                    </Sheet>
                </div>
            </nav>
        </header>
    );
}
