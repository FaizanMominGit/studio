
'use client'

import { DashboardHeader } from '@/components/dashboard-header';
import { AttendanceHistory } from '@/components/student/attendance-history';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { LogOut, QrCode, ScanLine } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { FaceEnrollment } from '@/components/student/face-enrollment';
import { useState } from 'react';

const ManualQrScanner = dynamic(() => import('@/components/student/manual-qr-scanner').then(mod => mod.ManualQrScanner), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
});

export default function StudentDashboard() {
  const router = useRouter();
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);

  const handleLogout = () => {
    // In a real app, you would sign out from Firebase here
    router.push('/');
  };
  
  const handleScanSuccess = (url: string) => {
    setIsQrDialogOpen(false);
    router.push(url);
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <DashboardHeader userType="Student">
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </DashboardHeader>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 bg-muted/40">
         <div className="grid gap-4 md:grid-cols-2 md:gap-8">
            <div className="space-y-4">
                <Card>
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                        <div className="p-3 rounded-full bg-primary/10 border border-primary/20">
                            <ScanLine className="h-8 w-8 text-primary" />
                        </div>
                        <div className="flex-1">
                            <CardTitle>Mark Your Attendance</CardTitle>
                            <CardDescription>Scan the QR code displayed by your professor.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
                          <DialogTrigger asChild>
                            <Button size="lg" className="w-full font-semibold">
                              <QrCode className="mr-2 h-5 w-5" />
                              Scan Lecture QR Code
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-sm">
                            <DialogHeader>
                              <DialogTitle>Scan QR Code</DialogTitle>
                              <DialogDescription>
                                Position the QR code from the professor's screen inside the box.
                              </DialogDescription>
                            </DialogHeader>
                            {/* Render scanner only when dialog is open to ensure camera is requested correctly */}
                            {isQrDialogOpen && <ManualQrScanner onScanSuccess={handleScanSuccess} />}
                          </DialogContent>
                        </Dialog>
                    </CardContent>
                </Card>
                 <FaceEnrollment />
            </div>
            <AttendanceHistory />
        </div>
      </main>
    </div>
  );
}
