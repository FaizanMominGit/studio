
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { auth, db } from '@/lib/firebase';
import { doc, onSnapshot, DocumentData } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Skeleton } from '../ui/skeleton';

type AttendanceRecord = {
  sessionId: string;
  subject: string;
  date: string;
  status: 'Present' | 'Absent';
};

export function AttendanceHistory() {
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeSnapshot = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            const userData = doc.data() as DocumentData;
            const attendanceData: any[] = userData.attendanceHistory || [];
            
            const formattedHistory: AttendanceRecord[] = attendanceData.map((item: any) => ({
                sessionId: item.sessionId,
                subject: item.subject,
                date: new Date(item.date).toLocaleDateString(),
                status: item.status,
            })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            setHistory(formattedHistory);
          } else {
            setHistory([]);
          }
          setLoading(false);
        }, (error) => {
            console.error("Error fetching attendance history: ", error);
            setLoading(false);
        });
         return () => unsubscribeSnapshot();
      } else {
         setLoading(false);
         setHistory([]);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance History</CardTitle>
        <CardDescription>A log of your attendance records for recent lectures.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-4 pr-4">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : history.length > 0 ? (
              history.map((item, index) => (
                <div key={item.sessionId || index}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item.subject}</p>
                      <p className="text-sm text-muted-foreground">{item.date}</p>
                    </div>
                    <Badge variant={item.status === 'Present' ? 'default' : 'destructive'} className={item.status === 'Present' ? 'bg-green-500 hover:bg-green-500/80' : ''}>
                      {item.status}
                    </Badge>
                  </div>
                  {index < history.length - 1 && <Separator className="mt-4" />}
                </div>
              ))
            ) : (
                <div className="text-center py-8 text-muted-foreground">
                    No attendance records found.
                </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
