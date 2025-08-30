
'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, Loader2, ArrowLeft, User, UserCheck, Library } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { FaceEnrollment } from '@/components/student/face-enrollment';
import { enrollFace } from '@/ai/flows/enroll-face';

const loginSchema = z.object({
    email: z.string().email({ message: 'Please enter a valid Outlook email address.' }).refine(
        (email) => email.endsWith('@vit.edu.in'),
        { message: 'Please use your college-provided Outlook ID (e.g., name@vit.edu.in).' }
    ),
    password: z.string().min(1, { message: 'Password is required.' }),
});

const registerSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid Outlook email address.' }).refine(
    (email) => email.endsWith('@vit.edu.in'),
    { message: 'Please use your college-provided Outlook ID (e.g., name@vit.edu.in).' }
  ),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long.' }),
  rollNo: z.string().optional(),
}).refine(data => {
    const role = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('role') || 'student';
    return role !== 'student' || (data.rollNo && data.rollNo.length > 0);
}, {
    message: "Roll number is required for students.",
    path: ["rollNo"],
});


type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;
type RegistrationStep = 'details' | 'face-enrollment';

export function AuthForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const role = searchParams.get('role') || 'student';
  const [activeTab, setActiveTab] = useState('login');
  const [isLoading, setIsLoading] = useState(false);
  const [registrationStep, setRegistrationStep] = useState<RegistrationStep>('details');
  const [registrationData, setRegistrationData] = useState<RegisterValues | null>(null);

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      rollNo: '',
    },
  });

  const handleRegistrationDetailsSubmit = (data: RegisterValues) => {
    if (role === 'student') {
      setRegistrationData(data);
      setRegistrationStep('face-enrollment');
    } else {
      // Professors don't need face enrollment
      completeRegistration(data);
    }
  };
  
  const completeRegistration = async (data: RegisterValues, faceDataUri?: string) => {
    setIsLoading(true);
    const { email, password, rollNo } = data;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userData: { email: string | null; role: string; faceDataUri?: string; rollNo?: string } = {
        email: user.email,
        role: role,
      };

      if (role === 'student') {
        if (faceDataUri && rollNo) {
            userData.faceDataUri = faceDataUri;
            userData.rollNo = rollNo;
        } else {
            throw new Error("Face enrollment and roll number are required for student registration.");
        }
      }

      await setDoc(doc(db, 'users', user.uid), userData);

      toast({
        title: 'Registration Successful!',
        description: 'You can now log in with your new credentials.',
      });
      setActiveTab('login');
      setRegistrationStep('details');
      registerForm.reset();
    } catch (error: any) {
      console.error("Registration error:", error);
      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: error.code === 'auth/email-already-in-use' 
            ? 'This email is already registered. Please log in.' 
            : (error.message || 'An unknown error occurred.'),
      });
      // On failure, stay on the current step or go back to details
      // setRegistrationStep('details'); 
    } finally {
      setIsLoading(false);
    }
  };

  const handleFaceEnrolled = async (faceDataUri: string) => {
      if (registrationData) {
          setIsLoading(true);
          try {
              const result = await enrollFace({
                  studentPhotoDataUri: faceDataUri,
                  studentId: registrationData.rollNo!, // rollNo is now guaranteed by the form
              });

              if (result.success) {
                  await completeRegistration(registrationData, faceDataUri);
              } else {
                  throw new Error(result.message || "AI check failed. Please use a clearer photo.");
              }
          } catch (error: any) {
              toast({
                  variant: 'destructive',
                  title: 'Enrollment Failed',
                  description: error.message || "Could not complete registration."
              });
              // Don't go back to details, allow user to retry enrollment
          } finally {
              setIsLoading(false);
          }
      }
  };


  const handleLoginSubmit = async (data: LoginValues) => {
    setIsLoading(true);
    const { email, password } = data;
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const userRole = userData.role;

        toast({
          title: 'Login Successful!',
          description: 'Redirecting to your dashboard...',
        });

        if (userRole === 'professor') {
          router.push('/professor-dashboard');
        } else if (userRole === 'student') {
          router.push('/student-dashboard');
        } else {
          // Fallback or error for unknown role
           throw new Error("Unknown user role. Please contact support.");
        }
      } else {
         throw new Error("User data not found in database. Please contact support.");
      }

    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.code === 'auth/invalid-credential' 
            ? 'Invalid email or password.' 
            : (error.message || 'An unknown error occurred during login.'),
      });
    } finally {
        setIsLoading(false);
    }
  };

  const roleTitle = role.charAt(0).toUpperCase() + role.slice(1);
  
  const renderRegisterForm = () => {
    if (role === 'student' && registrationStep === 'face-enrollment') {
      return (
        <div>
           <Button variant="ghost" size="sm" onClick={() => { setRegistrationStep('details'); setIsLoading(false); }} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Details
          </Button>
          <FaceEnrollment onEnrollmentComplete={handleFaceEnrolled} isPartOfRegistration={true} />
        </div>
      );
    }
    return (
       <Form {...registerForm}>
        <form onSubmit={registerForm.handleSubmit(handleRegistrationDetailsSubmit)} className="space-y-6 pt-4">
           {role === 'student' && (
              <FormField
                control={registerForm.control}
                name="rollNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Roll Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                         <Library className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                         <Input placeholder="e.g. S21101" {...field} className="pl-10" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
           )}
           <FormField
            control={registerForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>College Email</FormLabel>
                <FormControl>
                  <div className="relative">
                     <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                     <Input placeholder="your.name@vit.edu.in" {...field} className="pl-10" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={registerForm.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Create Password</FormLabel>
                 <FormControl>
                   <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="password" placeholder="Choose a strong password" {...field} className="pl-10" />
                   </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : (role === 'student' ? 'Next: Enroll Face' : 'Register')}
          </Button>
        </form>
       </Form>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            {role === 'student' ? <UserCheck /> : <User />}
            {roleTitle} Portal
        </CardTitle>
        <CardDescription>
          {activeTab === 'login' 
            ? 'Sign in to your account' 
            : (registrationStep === 'details' ? 'Create a new account' : 'Step 2: Face Enrollment')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(tab) => { setActiveTab(tab); setRegistrationStep('details'); loginForm.reset(); registerForm.reset(); setIsLoading(false); }} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login" disabled={isLoading || (role === 'student' && registrationStep === 'face-enrollment')}>Login</TabsTrigger>
            <TabsTrigger value="register" disabled={isLoading}>Register</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
             <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)} className="space-y-6 pt-4">
                 <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>College Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                           <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                           <Input placeholder="your.name@vit.edu.in" {...field} className="pl-10" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                       <FormControl>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input type="password" placeholder="••••••••" {...field} className="pl-10"/>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="animate-spin" /> : 'Login'}
                </Button>
              </form>
             </Form>
          </TabsContent>
          <TabsContent value="register">
            {renderRegisterForm()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
