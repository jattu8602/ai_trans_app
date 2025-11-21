/**
 * Extract and Transcribe Session Audio
 *
 * This script fetches all audio chunks from a session, combines them,
 * and transcribes using the /api/transcribe endpoint.
 *
 * Usage:
 *   pnpm tsx test/transcribe-session.ts <sessionId> [deviceId]
 *
 * Example:
 *   pnpm tsx test/transcribe-session.ts cmi91rmes000dn0uuqn95oumu de582fec-6a50-4d73-89fd-86663ea0230c
 *
 * If deviceId is not provided, the script will try to find it from the database.
 * Note: Database lookup requires DATABASE_URL environment variable to be set.
 */

// Load environment variables from .env file
import 'dotenv/config'

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'

interface Chunk {
  id: string
  chunkIndex: number
  duration: number
  timestamp: string
  audioData: string | null
  transcript: string | null
}

/**
 * Find deviceId for a session by querying the database
 * Only loads prisma when needed to avoid requiring DATABASE_URL when deviceId is provided
 */
async function findDeviceIdForSession(
  sessionId: string
): Promise<string | null> {
  try {
    // Lazy import prisma only when needed
    const { prisma } = await import('@/lib/prisma')

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    })

    if (!session) {
      return null
    }

    const deviceId = session.user.deviceId

    // Disconnect after use
    await prisma.$disconnect()

    return deviceId
  } catch (error) {
    if (error instanceof Error && error.message.includes('DATABASE_URL')) {
      console.error('❌ Error: DATABASE_URL environment variable is not set')
      console.log(
        '   Please provide deviceId as second argument, or set DATABASE_URL in .env file'
      )
    } else {
      console.error('Error finding deviceId:', error)
    }
    return null
  }
}

/**
 * Fetch all chunks for a session
 */
async function fetchChunks(
  sessionId: string,
  deviceId: string
): Promise<Chunk[]> {
  const url = `${API_BASE_URL}/api/sessions/${sessionId}/chunks?deviceId=${deviceId}`
  console.log(`📡 Fetching chunks from: ${url}`)

  const response = await fetch(url)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Failed to fetch chunks: ${response.status} ${response.statusText}\n${errorText}`
    )
  }

  const data = await response.json()
  return data.chunks || []
}

/**
 * Convert base64 string to Buffer
 */
function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64')
}

/**
 * Combine multiple audio buffers into a single buffer
 */
function combineAudioBuffers(buffers: Buffer[]): Buffer {
  return Buffer.concat(buffers)
}

/**
 * Transcribe audio using the /api/transcribe endpoint
 */
async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  console.log(`\n🎤 Sending audio for transcription...`)
  console.log(
    `   Audio size: ${(audioBuffer.length / (1024 * 1024)).toFixed(2)} MB`
  )

  // Create FormData with the audio file
  const formData = new FormData()
  // Convert Buffer to Uint8Array for Blob compatibility
  const audioUint8Array = new Uint8Array(audioBuffer)
  const audioBlob = new Blob([audioUint8Array], { type: 'audio/webm' })
  const audioFile = new File([audioBlob], 'combined-audio.webm', {
    type: 'audio/webm',
  })
  formData.append('audio', audioFile)

  const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Transcription failed: ${response.status} ${response.statusText}\n${
        errorData.error || errorData.warning || 'Unknown error'
      }`
    )
  }

  const data = await response.json()
  return data.transcript || ''
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('❌ Error: Session ID is required')
    console.log('\nUsage:')
    console.log('  pnpm tsx test/transcribe-session.ts <sessionId> [deviceId]')
    console.log('\nExample:')
    console.log(
      '  pnpm tsx test/transcribe-session.ts cmi91rmes000dn0uuqn95oumu de582fec-6a50-4d73-89fd-86663ea0230c'
    )
    process.exit(1)
  }

  const sessionId = args[0]
  let deviceId = args[1]

  console.log('🎵 Extract and Transcribe Session Audio\n')
  console.log(`Session ID: ${sessionId}`)

  // If deviceId not provided, try to find it from database
  if (!deviceId) {
    console.log('\n🔍 DeviceId not provided, searching database...')
    const foundDeviceId = await findDeviceIdForSession(sessionId)

    if (!foundDeviceId) {
      console.error('❌ Error: Could not find deviceId for this session')
      console.log('   Please provide deviceId as second argument')
      process.exit(1)
    }

    deviceId = foundDeviceId
    console.log(`✅ Found deviceId: ${deviceId}`)
  } else {
    console.log(`DeviceId: ${deviceId}`)
  }

  try {
    // Fetch chunks
    console.log('\n📦 Fetching audio chunks...')
    const chunks = await fetchChunks(sessionId, deviceId)

    if (chunks.length === 0) {
      console.error('❌ Error: No chunks found for this session')
      process.exit(1)
    }

    console.log(`✅ Found ${chunks.length} chunk(s)`)

    // Filter chunks with audio data
    const chunksWithAudio = chunks.filter(
      (chunk) => chunk.audioData && chunk.audioData.length > 0
    )

    if (chunksWithAudio.length === 0) {
      console.error('❌ Error: No chunks with audio data found')
      process.exit(1)
    }

    console.log(`✅ ${chunksWithAudio.length} chunk(s) have audio data`)

    // Show chunk info
    console.log('\n📊 Chunk Details:')
    chunksWithAudio.forEach((chunk) => {
      const audioSizeKB = chunk.audioData
        ? (Buffer.from(chunk.audioData, 'base64').length / 1024).toFixed(2)
        : '0'
      console.log(
        `   Chunk ${chunk.chunkIndex}: ${chunk.duration}s, ${audioSizeKB} KB${
          chunk.transcript ? ' (has transcript)' : ''
        }`
      )
    })

    // Convert base64 to buffers
    console.log('\n🔄 Converting base64 to audio buffers...')
    const audioBuffers = chunksWithAudio
      .sort((a, b) => a.chunkIndex - b.chunkIndex) // Ensure correct order
      .map((chunk) => base64ToBuffer(chunk.audioData!))

    // Combine all buffers
    console.log('🔗 Combining audio chunks...')
    const combinedAudio = combineAudioBuffers(audioBuffers)
    console.log(
      `✅ Combined audio: ${(combinedAudio.length / (1024 * 1024)).toFixed(
        2
      )} MB`
    )

    // Transcribe
    const transcript = await transcribeAudio(combinedAudio)

    // Print results
    console.log('\n' + '='.repeat(80))
    console.log('📄 TRANSCRIPTION RESULT')
    console.log('='.repeat(80))
    if (transcript.trim()) {
      console.log(`\n${transcript}\n`)
      console.log(`\n📊 Statistics:`)
      console.log(`   Length: ${transcript.length} characters`)
      console.log(
        `   Words: ${transcript.split(/\s+/).filter((w) => w).length}`
      )
    } else {
      console.log(
        '\n⚠️  Empty transcript (audio might be silence or unsupported format)'
      )
    }
    console.log('='.repeat(80) + '\n')
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Run the script
main().catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
