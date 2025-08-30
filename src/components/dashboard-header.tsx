import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, School } from 'lucide-react';

type DashboardHeaderProps = {
  userType: 'Student' | 'Professor';
  children?: React.ReactNode;
};

export function DashboardHeader({ userType, children }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold md:text-base"
        >
          <School className="h-6 w-6 text-primary" />
          <span className="font-bold">V-Attendance</span>
        </Link>
        <Link
          href={userType === 'Professor' ? '/professor-dashboard' : '/student-dashboard'}
          className="text-foreground transition-colors hover:text-foreground/80"
        >
          Dashboard
        </Link>
      </nav>
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 md:hidden"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left">
          <nav className="grid gap-6 text-lg font-medium">
             <Link
              href="/"
              className="flex items-center gap-2 text-lg font-semibold"
            >
              <School className="h-6 w-6 text-primary" />
              <span className="font-bold">V-Attendance</span>
            </Link>
            <Link href={userType === 'Professor' ? '/professor-dashboard' : '/student-dashboard'} className="text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
          </nav>
        </SheetContent>
      </Sheet>
      <div className="flex w-full items-center justify-end gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <span className="text-sm font-medium text-muted-foreground">{userType} View</span>
        {children}
      </div>
    </header>
  );
}
