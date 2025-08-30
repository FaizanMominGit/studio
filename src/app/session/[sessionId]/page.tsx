
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock, Users, XCircle, CheckCircle, Hourglass, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardHeader } from '@/components/dashboard-header';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

type Student = {
  name: string;
  rollNo: string;
  email: string;
  verificationPhoto?: string;
};

type SessionData = {
    attendedStudents: Student[];
    active: boolean;
    totalStudents: number;
    qrToken?: string;
};

export default function SessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [formattedDate, setFormattedDate] = useState('N/A');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(20);

  const lectureDetails = useMemo(() => {
    return {
      department: searchParams.get('department') || 'N/A',
      year: searchParams.get('year') || 'N/A',
      division: searchParams.get('division') || 'N/A',
      subject: searchParams.get('subject') || 'N/A',
      lectureTime: searchParams.get('lectureTime') || 'N/A',
    };
  }, [searchParams]);

  const updateQrCode = useCallback((token: string) => {
    if (typeof window !== 'undefined') {
      const urlToEncode = `${window.location.origin}/attend?sessionId=${sessionId}&token=${token}`;
      setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(urlToEncode)}`);
    }
  }, [sessionId]);

  useEffect(() => {
    setIsClient(true);
    const lectureDateString = searchParams.get('lectureDate');
    if (lectureDateString) {
      setFormattedDate(new Date(lectureDateString).toLocaleDateString());
    }
  }, [searchParams]);
  
   useEffect(() => {
    if (!sessionId) return;
    const sessionDocRef = doc(db, 'sessions', sessionId);

    // Firestore listener for real-time updates
    const unsubscribe = onSnapshot(sessionDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as SessionData;
        const previousToken = sessionData?.qrToken;
        setSessionData(data);
        
        // Update QR and reset countdown only if the token has actually changed
        if (data.qrToken && data.qrToken !== previousToken) {
          updateQrCode(data.qrToken);
          setCountdown(20);
        } else if (!previousToken && data.qrToken) { // Handle initial load
          updateQrCode(data.qrToken);
        }
      }
    });

    // Master timer to update the QR token in the database every 20 seconds
    const rotationIntervalId = setInterval(async () => {
        const docSnap = await getDoc(sessionDocRef);
        if (docSnap.exists() && docSnap.data().active) {
            const newQrToken = Date.now().toString();
            await updateDoc(sessionDocRef, { qrToken: newQrToken });
        }
    }, 20000);

    // UI countdown timer
    const countdownIntervalId = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 20)); // Reset to 20 if it reaches 0
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(rotationIntervalId);
      clearInterval(countdownIntervalId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, updateQrCode]);


  const endSession = async () => {
    if (sessionId) {
      const sessionDocRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionDocRef, { active: false });
    }
  };
  
  const attendedStudents = sessionData?.attendedStudents || [];
  const totalStudents = sessionData?.totalStudents || 60;
  const sessionActive = sessionData?.active ?? true;

  return (
    <div className="flex min-h-screen w-full flex-col">
      <DashboardHeader userType="Professor" />
      <main className="flex-1 p-4 md:p-8 bg-muted/40">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="md:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{lectureDetails.subject}</CardTitle>
                <CardDescription>
                  {lectureDetails.department} - {lectureDetails.year} (Div: {lectureDetails.division})
                </CardDescription>
                 <div className="flex items-center text-sm text-muted-foreground pt-2">
                    <Clock className="mr-2 h-4 w-4" />
                    <span>{formattedDate} at {lectureDetails.lectureTime}</span>
                </div>
              </CardHeader>
              <CardContent>
                <Alert variant={sessionActive ? "default" : "destructive"}>
                  {sessionActive ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <AlertTitle>{sessionActive ? "Session is Live" : "Session Ended"}</AlertTitle>
                  <AlertDescription>
                    {sessionActive ? "Students can now scan the QR code to mark their attendance." : "This attendance session is no longer active."}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
            
            <Dialog open={!!selectedImage} onOpenChange={(isOpen) => !isOpen && setSelectedImage(null)}>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle>Real-time Attendance</CardTitle>
                            <CardDescription>
                                Students who have successfully checked in will appear here. Click an image to enlarge.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-muted-foreground" />
                            <span className="font-bold text-2xl">{attendedStudents.length}</span>
                            <span className="text-sm text-muted-foreground">/ {totalStudents}</span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                            {attendedStudents.length > 0 ? attendedStudents.map((student, index) => (
                                <div key={index} className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <DialogTrigger asChild>
                                            <Avatar className="cursor-pointer">
                                                <AvatarImage 
                                                    src={student.verificationPhoto} 
                                                    onClick={() => setSelectedImage(student.verificationPhoto || null)} 
                                                />
                                                <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                        </DialogTrigger>
                                        <div>
                                            <p className="font-medium">{student.name}</p>
                                            <p className="text-sm text-muted-foreground">Roll No: {student.rollNo}</p>
                                        </div>
                                    </div>
                                    <Badge variant="secondary">Checked In</Badge>
                                </div>
                            )) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Hourglass className="mx-auto h-8 w-8 mb-2"/>
                                    <p>Waiting for students to check in...</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
                {selectedImage && (
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Verification Photo</DialogTitle>
                        </DialogHeader>
                        <div className="relative w-full aspect-square">
                            <Image
                                src={selectedImage}
                                alt="Student verification photo"
                                layout="fill"
                                objectFit="contain"
                                className="rounded-md"
                            />
                        </div>
                    </DialogContent>
                )}
            </Dialog>

          </div>

          <div className="space-y-8">
            <Card className="text-center">
              <CardHeader>
                <CardTitle>Scan to Attend</CardTitle>
                 <CardDescription>
                   {sessionActive ? `Code refreshing in ${countdown}s` : "This code is now inactive."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isClient && qrCodeUrl ? (
                  <div className={`relative w-[250px] h-[250px] mx-auto ${!sessionActive ? 'opacity-20' : ''}`}>
                    <Image
                      src={qrCodeUrl}
                      alt="Lecture QR Code"
                      width={250}
                      height={250}
                      className="rounded-lg border"
                    />
                    {sessionActive && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white opacity-0 hover:opacity-100 transition-opacity rounded-lg">
                           <RefreshCw className="h-8 w-8 animate-spin" style={{ animationDuration: '20s' }}/>
                           <p className="ml-2 font-semibold">Rotating QR Code</p>
                        </div>
                    )}
                  </div>
                ) : (
                  <Skeleton className="w-[250px] h-[250px] mx-auto rounded-lg" />
                )}
              </CardContent>
            </Card>
            <Button 
                onClick={endSession} 
                disabled={!sessionActive} 
                className="w-full" 
                variant="destructive"
                size="lg"
            >
              <XCircle className="mr-2 h-4 w-4" />
              End Session
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

    