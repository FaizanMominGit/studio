
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { auth, db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Skeleton } from '../ui/skeleton';

type AttendanceRecord = {
  subject: string;
  date: string;
  status: 'Present' | 'Absent';
};

export function AttendanceHistory() {
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeSnapshot = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            const userData = doc.data();
            const attendanceData = userData.attendanceHistory || [];
            
            const formattedHistory = attendanceData.map((item: any) => ({
                subject: item.subject,
                date: new Date(item.date).toLocaleDateString(),
                status: item.status,
            })).reverse(); // show most recent first
            setHistory(formattedHistory);
          }
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
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            ) : history.length > 0 ? (
              history.map((item, index) => (
                <div key={index}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item.subject}</p>
                      <p className="text-sm text-muted-foreground">{item.date}</p>
                    </div>
                    <Badge variant={item.status === 'Present' ? 'default' : 'destructive'} className={item.status === 'Present' ? 'bg-green-500' : ''}>
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
