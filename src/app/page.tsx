import { GreetingForm } from "@/components/greeting-form";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <GreetingForm />
    </main>
  );
}
