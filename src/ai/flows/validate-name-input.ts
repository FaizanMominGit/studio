'use server';

/**
 * @fileOverview Name validation flow to check for disallowed characters or scripts.
 *
 * - validateNameInput - A function that validates the name input.
 * - ValidateNameInputInput - The input type for the validateNameInput function.
 * - ValidateNameInputOutput - The return type for the validateNameInput function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ValidateNameInputInputSchema = z.object({
  name: z.string().describe('The name to validate.'),
});
export type ValidateNameInputInput = z.infer<typeof ValidateNameInputInputSchema>;

const ValidateNameInputOutputSchema = z.object({
  isValid: z.boolean().describe('Whether the name is valid or not.'),
  reason: z.string().optional().describe('The reason why the name is invalid, if applicable.'),
});
export type ValidateNameInputOutput = z.infer<typeof ValidateNameInputOutputSchema>;

export async function validateNameInput(input: ValidateNameInputInput): Promise<ValidateNameInputOutput> {
  return validateNameInputFlow(input);
}

const validateNameInputPrompt = ai.definePrompt({
  name: 'validateNameInputPrompt',
  input: {schema: ValidateNameInputInputSchema},
  output: {schema: ValidateNameInputOutputSchema},
  prompt: `You are a helpful assistant that validates user names to ensure they contain only allowed characters and scripts.

  Analyze the following name:
  {{name}}

  Determine if the name is valid. A name is considered invalid if it contains any disallowed characters (e.g., special symbols, emojis) or non-standard scripts (e.g., Cyrillic, Chinese).  Latin characters and common diacritics are allowed.

  Respond with a JSON object indicating whether the name is valid and, if not, provide a reason.
  Be brief in your reasoning.
  `,
});

const validateNameInputFlow = ai.defineFlow(
  {
    name: 'validateNameInputFlow',
    inputSchema: ValidateNameInputInputSchema,
    outputSchema: ValidateNameInputOutputSchema,
  },
  async input => {
    const {output} = await validateNameInputPrompt(input);
    return output!;
  }
);
