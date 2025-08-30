import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookUser, School, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background to-blue-50/50 p-4">
      <div className="text-center mb-12">
        <h1 className="text-5xl md:text-6xl font-bold text-primary tracking-tight">
          V-Attendance
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          A seamless, secure, and smart solution for managing college attendance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <Card className="hover:shadow-xl transition-shadow duration-300">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <School className="w-8 h-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">For Professors</CardTitle>
                <CardDescription>Manage lectures & track attendance in real-time.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Create lecture sessions, generate QR codes, and monitor student check-ins instantly. Includes offline support for manual attendance.
            </p>
            <Button asChild className="w-full">
              <Link href="/login?role=professor">
                Login as Professor
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl transition-shadow duration-300">
          <CardHeader>
             <div className="flex items-center gap-4">
               <div className="p-3 bg-accent/10 rounded-full">
                <BookUser className="w-8 h-8 text-accent" />
              </div>
              <div>
                <CardTitle className="text-2xl">For Students</CardTitle>
                <CardDescription>Mark your attendance quickly and securely.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Scan a QR code, verify your identity with face recognition, and get your attendance marked within seconds.
            </p>
            <Button asChild className="w-full">
              <Link href="/login?role=student">
                Login as Student
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      <footer className="mt-16 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} VAttendance. All rights reserved.</p>
      </footer>
    </main>
  );
}
