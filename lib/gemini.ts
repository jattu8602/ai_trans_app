/**
 * Google Gemini AI service for generating meeting summaries
 * Uses Gemini REST API directly to create detailed, well-structured summaries from transcripts
 */

const SYSTEM_PROMPT = `You are an expert meeting assistant specialized in analyzing conversation transcripts and generating comprehensive, well-structured summaries with rich formatting.

Your task is to analyze the provided conversation transcript and create a detailed summary that captures:

1. **Key Points**: Main topics discussed, important information shared, and central themes
2. **Action Items**: Specific tasks, assignments, or follow-ups mentioned with responsible parties (if identified)
3. **Decisions Made**: Important decisions, agreements, or conclusions reached during the conversation
4. **Context**: Background information, relevant details, and important context that helps understand the conversation
5. **Participants' Contributions**: Key points made by different speakers (if speaker identification is available)

**Summary Requirements:**
- Be comprehensive and detailed - capture all important information
- Use clear, professional language
- Organize information logically with clear sections
- Highlight action items and decisions prominently
- Maintain the original meaning and context
- If the conversation is in multiple languages (e.g., Hindi/English mix), preserve the language used while ensuring clarity
- Format the summary with proper headings, bullet points, and structure for easy reading

**Rich Text Formatting Requirements:**
- Use Markdown formatting for better visibility
- **Highlight speaker names** using bold formatting: **Speaker 1**, **Speaker 2**, etc.
- Use **bold text** to emphasize important points, key terms, deadlines, and critical information
- Use *italic text* for emphasis on secondary important points
- Use > blockquotes for important quotes or statements
- Use code formatting (backticks) for technical terms, system names, or specific values
- Use ## for main section headings and ### for subsections
- Use bullet points (-) and numbered lists (1.) appropriately
- Highlight action items with **bold** and use [Speaker Name] format for assignments
- Use emojis sparingly for visual cues: ✅ for completed items, ⚠️ for warnings, 🎯 for goals, 📋 for action items

**Output Format:**
Structure your summary with clear sections using Markdown:
- ## Meeting Summary (main heading)
- ### Overview/Context
- ### Key Discussion Points (with **bold** highlights for important points)
- ### Decisions Made (with **bold** for each decision)
- ### Action Items (with **[Speaker Name]** format and **bold** for tasks)
- ### Additional Notes (if any)

**Important Formatting Guidelines:**
- Always identify speakers as **Speaker 1**, **Speaker 2**, etc. in action items and when attributing statements
- Bold all important technical terms, deadlines, numbers, and critical information
- Make action items stand out with bold formatting and clear speaker attribution
- Use proper Markdown syntax that will render beautifully in HTML

Generate a summary that would be valuable for someone who couldn't attend the meeting or needs a quick reference, with rich formatting that makes important information easy to scan and understand.`

/**
 * Generate a detailed summary from a conversation transcript using Google Gemini
 * @param transcript - The full conversation transcript text
 * @returns Promise resolving to the generated summary
 * @throws Error if API key is missing or generation fails
 */
export async function generateSummary(transcript: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY

  if (!apiKey) {
    throw new Error(
      'GOOGLE_GEMINI_API_KEY environment variable is not set. Please set it in your .env file.'
    )
  }

  if (!transcript || transcript.trim().length === 0) {
    throw new Error(
      'Transcript is empty. Cannot generate summary from empty transcript.'
    )
  }

  try {
    // Model fallback list - try in order until one works
    const modelCandidates = [
      process.env.GEMINI_MODEL_NAME, // User preference first
      'gemini-2.0-flash', // Latest fast model
      'gemini-1.5-pro', // Stable pro model
      'gemini-1.5-flash', // Stable flash model
      'gemini-pro', // Original stable model
    ].filter(Boolean) as string[]

    console.log(
      `[Gemini] Will try models in order: ${modelCandidates.join(', ')}`
    )

    const prompt = `${SYSTEM_PROMPT}

**Conversation Transcript:**
${transcript}

Please analyze the above transcript and generate a comprehensive, well-structured summary following the requirements outlined above.`

    console.log('[Gemini] Generating summary...', {
      transcriptLength: transcript.length,
      wordCount: transcript.split(/\s+/).length,
    })

    // Try each model candidate until one works
    let lastError: Error | null = null

    for (const modelName of modelCandidates) {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`
      console.log(`[Gemini] Trying model: ${modelName}`)

      // Call Gemini API with retry logic for this model
      const maxRetries = 2 // Fewer retries per model since we're trying multiple models
      let modelSucceeded = false

      try {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(
              `[Gemini] API attempt ${attempt}/${maxRetries} with ${modelName}`
            )

            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minute timeout

            const response = await fetch(`${apiUrl}?key=${apiKey}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: prompt,
                      },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: 0.3,
                  topK: 1,
                  topP: 1,
                  maxOutputTokens: 4096,
                },
              }),
              signal: controller.signal,
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
              const errorText = await response
                .text()
                .catch(() => 'Unknown error')
              // If it's a 404 (model not found), try next model instead of retrying
              if (response.status === 404) {
                console.log(
                  `[Gemini] Model ${modelName} not found (404), trying next model...`
                )
                break // Break out of retry loop, try next model
              }
              throw new Error(
                `Gemini API error: ${response.status} - ${response.statusText}. ${errorText}`
              )
            }

            const data = await response.json()

            if (
              !data.candidates ||
              !data.candidates[0] ||
              !data.candidates[0].content
            ) {
              throw new Error('Invalid response structure from Gemini API')
            }

            const summary = data.candidates[0].content.parts[0].text

            if (!summary || summary.trim().length === 0) {
              throw new Error('Gemini returned an empty summary')
            }

            console.log(
              `[Gemini] Summary generated successfully with ${modelName}`,
              {
                summaryLength: summary.length,
                wordCount: summary.split(/\s+/).length,
              }
            )

            modelSucceeded = true
            return summary.trim()
          } catch (error) {
            lastError =
              error instanceof Error ? error : new Error(String(error))

            // If it's a 404, don't retry this model, try next one
            if (error instanceof Error && error.message.includes('404')) {
              console.log(
                `[Gemini] Model ${modelName} not available, trying next model...`
              )
              break
            }

            console.error(
              `[Gemini] API attempt ${attempt} failed with ${modelName}:`,
              lastError.message
            )

            if (attempt === maxRetries) {
              // If this was the last model, throw the error
              if (modelName === modelCandidates[modelCandidates.length - 1]) {
                throw lastError
              }
              // Otherwise, try next model
              break
            }

            // Wait before retry (exponential backoff)
            const waitTime = Math.pow(2, attempt) * 1000
            console.log(`[Gemini] Waiting ${waitTime}ms before retry...`)
            await new Promise((resolve) => setTimeout(resolve, waitTime))
          }
        }

        // If model succeeded, we would have returned already
        // If we're here and it's not the last model, try next one
        if (
          !modelSucceeded &&
          modelName !== modelCandidates[modelCandidates.length - 1]
        ) {
          console.log(
            `[Gemini] Model ${modelName} failed, trying next model...`
          )
          continue
        }
      } catch (modelError) {
        // If this model completely failed and it's the last one, throw
        if (modelName === modelCandidates[modelCandidates.length - 1]) {
          throw modelError
        }
        // Otherwise continue to next model
        lastError =
          modelError instanceof Error
            ? modelError
            : new Error(String(modelError))
        continue
      }
    }

    // If we get here, all models failed
    throw (
      lastError ||
      new Error('Failed to generate summary with all available models')
    )
  } catch (error) {
    console.error('[Gemini] Error generating summary:', error)

    if (error instanceof Error) {
      // Provide more helpful error messages
      if (error.message.includes('API_KEY') || error.message.includes('401')) {
        throw new Error(
          'Invalid or missing Google Gemini API key. Please check your GOOGLE_GEMINI_API_KEY environment variable.'
        )
      }
      if (
        error.message.includes('quota') ||
        error.message.includes('rate limit') ||
        error.message.includes('429')
      ) {
        throw new Error(
          'Gemini API quota exceeded or rate limit reached. Please try again later.'
        )
      }
      if (
        error.message.includes('404') ||
        error.message.includes('not found')
      ) {
        const currentModel = process.env.GEMINI_MODEL_NAME || 'gemini-2.0-flash'
        throw new Error(
          `Model "${currentModel}" not found or not available. Try setting GEMINI_MODEL_NAME to: gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash, or gemini-pro`
        )
      }
      throw error
    }

    throw new Error(
      `Failed to generate summary: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }
}
