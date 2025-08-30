// src/ai/flows/verify-face.ts
'use server';

/**
 * @fileOverview Verifies the student's face for attendance using AI.
 *
 * - verifyFace - A function that verifies the face for attendance.
 * - VerifyFaceInput - The input type for the verifyFace function.
 * - VerifyFaceOutput - The return type for the verifyFace function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const VerifyFaceInputSchema = z.object({
  livePhotoDataUri: z
    .string()
    .describe(
      "A photo of the student's face taken live, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  enrolledFaceDataUri: z
    .string()
    .describe(
      "A photo of the student's enrolled face, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  studentName: z.string().describe('The name of the student.'),
});
export type VerifyFaceInput = z.infer<typeof VerifyFaceInputSchema>;

const VerifyFaceOutputSchema = z.object({
  isMatch: z.boolean().describe('Whether the live face matches the enrolled face.'),
  confidence: z
    .number()
    .describe('The confidence score of the face match, between 0 and 1.'),
  reason: z.string().describe('The reason for the match or mismatch.'),
});
export type VerifyFaceOutput = z.infer<typeof VerifyFaceOutputSchema>;

export async function verifyFace(input: VerifyFaceInput): Promise<VerifyFaceOutput> {
  return verifyFaceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'verifyFacePrompt',
  input: {schema: VerifyFaceInputSchema},
  output: {schema: VerifyFaceOutputSchema},
  prompt: `You are an AI assistant specializing in face recognition.

You are provided with two images: a live photo of a student and an enrolled photo of the same student. Your task is to determine if the two images belong to the same person.

Here are the details:
Student Name: {{{studentName}}}
Live Photo: {{media url=livePhotoDataUri}}
Enrolled Photo: {{media url=enrolledFaceDataUri}}

Analyze the two images and determine if they match. Provide a confidence score (between 0 and 1) and a reason for your decision. A confidence score above 0.8 should be considered a match.
`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ],
  },
});

const verifyFaceFlow = ai.defineFlow(
  {
    name: 'verifyFaceFlow',
    inputSchema: VerifyFaceInputSchema,
    outputSchema: VerifyFaceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
