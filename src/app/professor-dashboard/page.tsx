
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LectureForm } from '@/components/professor/lecture-form';
import { DashboardHeader } from '@/components/dashboard-header';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { LogOut, History } from 'lucide-react';
import { PastSessionsList } from '@/components/professor/past-sessions-list';
import { Separator } from '@/components/ui/separator';


export default function ProfessorDashboard() {
  const router = useRouter();

  const handleLogout = () => {
    // In a real app, you would clear the session/token here
    router.push('/');
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <DashboardHeader userType="Professor">
         <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </DashboardHeader>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 bg-muted/40">
        <div className="grid gap-4 md:gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Create New Lecture Session</CardTitle>
              <CardDescription>
                Fill in the details below to start a new attendance session and generate a QR code for students.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LectureForm />
            </CardContent>
          </Card>
          
          <Separator />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-6 w-6" />
                Past Lecture Sessions
              </CardTitle>
              <CardDescription>
                Review attendance records from your previous lecture sessions.
              </CardDescription>
            </CardHeader>
            <CardContent>
                <PastSessionsList />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
