'use server';
/**
 * @fileOverview An AI agent to enroll a student's face for attendance verification.
 *
 * - enrollFace - A function that handles the face enrollment process.
 * - EnrollFaceInput - The input type for the enrollFace function.
 * - EnrollFaceOutput - The return type for the enrollFace function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EnrollFaceInputSchema = z.object({
  studentPhotoDataUri: z
    .string()
    .describe(
      "A photo of the student's face, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  studentId: z.string().describe('The unique identifier of the student.'),
});
export type EnrollFaceInput = z.infer<typeof EnrollFaceInputSchema>;

const EnrollFaceOutputSchema = z.object({
  success: z.boolean().describe('Whether or not the face enrollment was successful.'),
  message: z.string().describe('A message indicating the result of the face enrollment.'),
});
export type EnrollFaceOutput = z.infer<typeof EnrollFaceOutputSchema>;

export async function enrollFace(input: EnrollFaceInput): Promise<EnrollFaceOutput> {
  return enrollFaceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'enrollFacePrompt',
  input: {schema: EnrollFaceInputSchema},
  output: {schema: EnrollFaceOutputSchema},
  prompt: `You are an AI assistant that helps to enroll a student's face for attendance verification.

You will receive a photo of the student's face and the student's ID.

You will determine if the photo contains a clear, single, human face. If it does, the enrollment is successful.

Considerations:
- Check if the photo is clear and the face is visible.
- If no face is detected or the image is blurry, enrollment should fail.
- Ensure that the student ID is valid.

Input:
Student ID: {{{studentId}}}
Student Photo: {{media url=studentPhotoDataUri}}

Output:
Indicate whether the face enrollment was successful or not and provide a message.`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
       {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE',
      },
       {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_NONE',
      },
       {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE',
      },
    ],
  },
});

const enrollFaceFlow = ai.defineFlow(
  {
    name: 'enrollFaceFlow',
    inputSchema: EnrollFaceInputSchema,
    outputSchema: EnrollFaceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
