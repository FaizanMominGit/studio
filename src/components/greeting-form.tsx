"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { validateNameInput } from "@/ai/flows/validate-name-input";

const FormSchema = z.object({
  name: z.string().min(1, { message: "Please enter your name." }),
});

export function GreetingForm() {
  const [greeting, setGreeting] = useState("Hello, World!");
  const [aiValidationError, setAiValidationError] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isGreetingVisible, setIsGreetingVisible] = useState(true);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
    },
  });

  async function onSubmit(values: z.infer<typeof FormSchema>) {
    setIsLoading(true);
    setAiValidationError(null);
    setIsGreetingVisible(false);

    try {
      const result = await validateNameInput({ name: values.name });

      setTimeout(() => {
        if (result.isValid) {
          setGreeting(`Hello, ${values.name}!`);
        } else {
          setAiValidationError(result.reason || "This name is not allowed.");
        }
        setIsGreetingVisible(true);
      }, 300); // Corresponds to transition duration
    } catch (error) {
      console.error("Validation failed:", error);
      setAiValidationError("An unexpected error occurred during validation.");
      setTimeout(() => {
        setIsGreetingVisible(true);
      }, 300);
    } finally {
       // Delay setting loading to false to allow fade-in animation to complete
       setTimeout(() => {
        setIsLoading(false);
       }, 500);
    }
  }

  return (
    <Card className="w-full max-w-md shadow-lg border-2">
      <CardHeader>
        <CardTitle className="text-center text-3xl font-headline tracking-tight">
          React Hello World
        </CardTitle>
        <CardDescription className="text-center">
          Enter your name for a personalized greeting.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-12 items-center justify-center mb-6">
          <h1
            className={`text-4xl font-headline text-primary transition-opacity duration-300 ${
              isGreetingVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            {greeting}
          </h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Jane Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {aiValidationError && (
              <p className="text-sm font-medium text-destructive">
                {aiValidationError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Update Greeting"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
