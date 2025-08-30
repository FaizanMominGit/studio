
'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const AuthForm = dynamic(() => import('@/components/auth-form').then(mod => mod.AuthForm), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
});

function LoginPageContent() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <AuthForm />
    </main>
  );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>}>
            <LoginPageContent />
        </Suspense>
    )
}
