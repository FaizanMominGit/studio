
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { CalendarIcon, ClockIcon } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

const lectureFormSchema = z.object({
  department: z.string().min(2, { message: 'Department is required.' }),
  year: z.string({ required_error: 'Please select a year.' }),
  division: z.string().min(1, { message: 'Division is required.' }).max(1),
  subject: z.string().min(3, { message: 'Subject name must be at least 3 characters.' }),
  lectureDate: z.date({ required_error: 'A date for the lecture is required.' }),
  lectureTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Invalid time format (HH:MM).' }),
});

type LectureFormValues = z.infer<typeof lectureFormSchema>;

export function LectureForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<LectureFormValues>({
    resolver: zodResolver(lectureFormSchema),
    defaultValues: {
      department: '',
      division: '',
      subject: '',
      lectureTime: new Date().toTimeString().slice(0,5),
    },
  });

  async function onSubmit(data: LectureFormValues) {
    setIsLoading(true);
    const currentUser = auth.currentUser;
    if (!currentUser) {
        toast({
            variant: "destructive",
            title: "Authentication Error",
            description: "You must be logged in to create a session."
        });
        setIsLoading(false);
        return;
    }
    
    const sessionId = Date.now().toString();
    
    try {
      // Save session to Firestore
      const sessionDocRef = doc(db, 'sessions', sessionId);
      await setDoc(sessionDocRef, {
        ...data,
        lectureDate: data.lectureDate.toISOString(),
        createdAt: new Date().toISOString(),
        active: true,
        attendedStudents: [],
        professorId: currentUser.uid, // Add professor's UID
        qrToken: Date.now().toString(), // Add initial QR token
      });
      
      const query = new URLSearchParams({
        ...data,
        lectureDate: data.lectureDate.toISOString(),
      }).toString();
      
      router.push(`/session/${sessionId}?${query}`);

      toast({
        title: "Lecture Session Created!",
        description: "Redirecting you to the live session page.",
      });

    } catch (error) {
        console.error("Error creating session:", error);
        toast({
            variant: "destructive",
            title: "Failed to create session",
            description: "Could not save session to the database. Please try again."
        });
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FormField
            control={form.control}
            name="department"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Department</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Computer Science" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Year</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select student year" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="First Year">First Year</SelectItem>
                    <SelectItem value="Second Year">Second Year</SelectItem>
                    <SelectItem value="Third Year">Third Year</SelectItem>
                    <SelectItem value="Final Year">Final Year</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="division"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Division</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., A" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subject / Course Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Data Structures" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lectureDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Lecture Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-full pl-3 text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() - 1))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lectureTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lecture Time (24h format)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <ClockIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="time" className="pl-10" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" size="lg" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate QR Code
        </Button>
      </form>
    </Form>
  );
}
