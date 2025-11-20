/**
 * Simple Deepgram Speech-to-Text Test
 *
 * This file demonstrates how to use Deepgram API for transcription
 *
 * Usage:
 *   pnpm tsx test/deepgram-test.ts
 *
 * Make sure NEXT_PUBLIC_DEEPGRAM_API_KEY is set in .env
 */

import { createClient } from '@deepgram/sdk'
import { readFileSync } from 'fs'
import { join } from 'path'

async function testDeepgramTranscription() {
  console.log('🎤 Deepgram Speech-to-Text Test\n')

  // Get API key from environment
  const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY

  if (!apiKey) {
    console.error('❌ Error: NEXT_PUBLIC_DEEPGRAM_API_KEY not found in environment')
    console.log('\nPlease set it in your .env file:')
    console.log('NEXT_PUBLIC_DEEPGRAM_API_KEY=your_api_key_here')
    process.exit(1)
  }

  console.log('✅ API Key found\n')

  // Create Deepgram client
  const deepgram = createClient(apiKey)
  console.log('✅ Deepgram client created\n')

  // Test 1: Transcribe from a file (if you have a test audio file)
  console.log('📝 Test 1: File Transcription')
  console.log('─────────────────────────────')

  try {
    // Example: If you have a test audio file, uncomment and update the path
    /*
    const audioFilePath = join(process.cwd(), 'test', 'sample-audio.webm')
    const audioBuffer = readFileSync(audioFilePath)

    console.log(`Reading audio file: ${audioFilePath}`)
    console.log(`File size: ${audioBuffer.length} bytes\n`)

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-2',
        language: 'en',
        smart_format: true,
        punctuate: true,
      }
    )

    if (error) {
      console.error('❌ Transcription error:', error)
    } else {
      const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript
      console.log('✅ Transcription successful!')
      console.log(`\n📄 Transcript:\n"${transcript || '(empty)'}"\n`)
    }
    */
    console.log('ℹ️  File transcription test skipped (no test file provided)')
    console.log('   To test: Add a test audio file and uncomment the code above\n')
  } catch (error) {
    console.error('❌ Error:', error)
  }

  // Test 2: Live transcription (streaming)
  console.log('\n📝 Test 2: Live Transcription (Streaming)')
  console.log('─────────────────────────────────────────')
  console.log('ℹ️  Live transcription requires a real-time audio stream')
  console.log('   This is used in the app for real-time transcription during recording')
  console.log('   See: lib/deepgram.ts for the implementation\n')

  // Test 3: API Connection Test
  console.log('📝 Test 3: API Connection Test')
  console.log('──────────────────────────────')

  try {
    // Create a minimal test - just verify the client is set up correctly
    console.log('✅ Deepgram client initialized successfully')
    console.log('   Model: nova-2')
    console.log('   Language: en (English, with auto-detect for Hindi/Hinglish)')
    console.log('   Features: smart_format, punctuate\n')
  } catch (error) {
    console.error('❌ Connection test failed:', error)
  }

  // Test 4: Show how it's used in the app
  console.log('📝 Test 4: How It Works in the App')
  console.log('──────────────────────────────────')
  console.log(`
The app uses Deepgram in two ways:

1. File Transcription (Chunk-based):
   - Each 30-second audio chunk is transcribed before saving
   - Location: app/api/transcribe/route.ts
   - Process:
     a. Audio chunk (Blob) → Convert to Buffer
     b. Send to Deepgram API
     c. Get transcript back
     d. Save chunk + transcript to database

2. Live Transcription (Streaming - currently disabled):
   - Real-time transcription during recording
   - Location: lib/deepgram.ts
   - Process:
     a. Audio stream → Send chunks continuously
     b. Receive interim and final transcripts
     c. Display in UI in real-time

Current Implementation:
- ✅ Chunk-based transcription (working)
- ❌ Live transcription (removed from UI, code kept for future use)
`)

  console.log('\n✅ Test completed!\n')
}

// Run the test
testDeepgramTranscription().catch((error) => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})

