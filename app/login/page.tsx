import { FullScreenSignup } from '@/components/ui/full-screen-signup';
import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    redirect('/dashboard');
  }
  return <FullScreenSignup />;
}
