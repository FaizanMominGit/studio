
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Calendar, Clock, Users, ArrowRight } from 'lucide-react';

type Session = {
    id: string;
    subject: string;
    lectureDate: string;
    lectureTime: string;
    department: string;
    year: string;
    division: string;
    attendedStudents: any[];
    createdAt: string; // Added for sorting
};

export function PastSessionsList() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            if (!user) {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!currentUser) return;

        const sessionsQuery = query(
            collection(db, 'sessions'),
            where('professorId', '==', currentUser.uid)
        );

        const unsubscribe = onSnapshot(sessionsQuery, (snapshot) => {
            const sessionsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as Session[];

            // Sort on the client-side to avoid needing a composite index
            sessionsData.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            });

            setSessions(sessionsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const handleSessionClick = (session: Session) => {
        const queryParams = new URLSearchParams({
            department: session.department,
            year: session.year,
            division: session.division,
            subject: session.subject,
            lectureDate: session.lectureDate,
            lectureTime: session.lectureTime,
        }).toString();
        router.push(`/session/${session.id}?${queryParams}`);
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    if (sessions.length === 0) {
        return <p className="text-muted-foreground text-center">You haven't created any lecture sessions yet.</p>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => (
                <Card 
                    key={session.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleSessionClick(session)}
                >
                    <CardHeader>
                        <CardTitle className="truncate">{session.subject}</CardTitle>
                        <CardDescription>{session.department} - {session.year}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center text-sm text-muted-foreground">
                            <Calendar className="mr-2 h-4 w-4" />
                            <span>{format(new Date(session.lectureDate), 'PPP')}</span>
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                            <Clock className="mr-2 h-4 w-4" />
                            <span>{session.lectureTime}</span>
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                            <Users className="mr-2 h-4 w-4" />
                            <span>{session.attendedStudents.length} student(s) attended</span>
                        </div>
                    </CardContent>
                    <div className="p-6 pt-0 flex justify-end">
                        <ArrowRight className="h-5 w-5 text-primary" />
                    </div>
                </Card>
            ))}
        </div>
    );
}
