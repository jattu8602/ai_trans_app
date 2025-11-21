# Usage Guide

## Getting Started

ScribeAI allows you to record audio sessions, transcribe them, and generate AI-powered summaries. This guide walks you through all features.

## Recording a Session

### Step 1: Start Recording

1. Open the application at [http://localhost:3000](http://localhost:3000)
2. You'll see two options:
   - **Quick Record (Mic)**: Start recording immediately with microphone
   - **Advanced Options**: Choose recording mode

### Step 2: Choose Recording Mode

Click "Advanced Options" to see recording modes:

#### Option A: System Mic Only
- Records only from your microphone
- Best for: Personal notes, voice memos
- Simple setup, no permissions needed

#### Option B: Complete System Voice
- Records system audio + microphone
- Best for: Google Meet, Zoom, Teams meetings
- Requires screen sharing permission

**For System Audio:**
1. Click "Complete System Voice"
2. Browser will prompt for screen sharing
3. Select the tab with audio (e.g., Google Meet tab)
4. **Important**: Check "Share tab audio" checkbox
5. Click "Share"
6. Allow microphone access when prompted

### Step 3: Recording Interface

Once recording starts, you'll see:

- **Timer**: Shows recording duration (MM:SS format)
- **Audio Visualizer**: Real-time waveform display
- **Controls**:
  - **Pause**: Temporarily pause recording
  - **Resume**: Continue recording after pause
  - **Stop**: End recording and save session

### Step 4: During Recording

- Audio is automatically chunked every 30 seconds
- Chunks are saved locally (IndexedDB) and uploaded to server
- Toast notifications show chunk upload progress
- You can pause/resume at any time

### Step 5: Stop Recording

1. Click "Stop" button
2. Recording ends and final chunk is saved
3. Session is marked as "completed"
4. You're redirected to the session details page

## Viewing Sessions

### Session List

The left sidebar shows:
- All your recording sessions
- Session status (Processing, Completed)
- Duration for completed sessions
- Click any session to view details

### Session Details Page

After stopping a recording, you'll see:

1. **Session Header**: Title, duration, status
2. **Audio Player**: Play back the recorded audio
3. **Generate Buttons**:
   - "Generate Transcribe & Summary" (if no transcript)
   - "Generate Summary" (if transcript exists)
4. **Transcript Canvas**: Displays full transcript (when generated)
5. **Summary Canvas**: Displays AI summary (when generated)
6. **Chunks Info**: Number of audio chunks recorded

## Generating Transcript

### When to Generate

- Transcripts are generated **on-demand** (not during recording)
- This saves API costs and gives you control
- You can generate transcript anytime after recording

### How to Generate

1. Navigate to a session with recorded audio
2. Click "Generate Transcribe & Summary" button
3. Wait for transcription (shows "Transcribing..." status)
4. Transcript appears in the Transcript canvas
5. Summary generation starts automatically after transcript

### What Happens

1. All audio chunks are fetched from database
2. Chunks are combined into single audio file
3. Audio is sent to Deepgram API for transcription
4. Full transcript is saved to database
5. Session status updates to "transcribed"

**Note**: Transcription may take 1-2 minutes for long sessions.

## Generating Summary

### Automatic Generation

- Summary is generated automatically after transcript
- Shows "Generating Summary..." status
- Uses Google Gemini AI with rich formatting

### Manual Generation

If transcript exists but summary failed:
1. Click "Generate Summary" button
2. Summary is generated from existing transcript
3. No need to re-transcribe

### Summary Features

The AI-generated summary includes:

- **Overview/Context**: Meeting background
- **Key Discussion Points**: Main topics covered
- **Decisions Made**: Important decisions
- **Action Items**: Tasks with speaker attribution
- **Additional Notes**: Other relevant information

**Rich Formatting**:
- Speaker names highlighted in blue
- Important points highlighted in yellow
- Proper markdown formatting (headings, lists, etc.)

## Playing Back Audio

### Audio Player

1. Navigate to session details page
2. Audio player appears at the top
3. Click play to hear the recording
4. Player shows current time and duration

### How It Works

- Audio chunks are combined from IndexedDB or server
- Seamless playback across all chunks
- Works even if some chunks are missing

## Session Management

### Editing Session Title

1. Click on session title (if editable)
2. Enter new title
3. Title is saved automatically

### Deleting Sessions

1. Navigate to session details
2. Click delete button (if available)
3. Confirm deletion
4. Session and all chunks are removed

### Session Status

Sessions have different statuses:

- **pending**: Created but not recording
- **recording**: Actively recording
- **paused**: Recording paused
- **processing**: Generating transcript/summary
- **completed**: Finished with transcript/summary

## Tips & Best Practices

### For Best Audio Quality

1. **Use good microphone**: External mic recommended for meetings
2. **Quiet environment**: Reduce background noise
3. **Check permissions**: Ensure mic/system audio access granted
4. **Stable connection**: Good internet for chunk uploads

### For System Audio Recording

1. **Chrome/Edge recommended**: Best system audio support
2. **Select correct tab**: Choose the tab with meeting audio
3. **Enable tab audio**: Check "Share tab audio" checkbox
4. **Test first**: Record a short test before important meeting

### For Long Sessions

1. **Monitor chunk count**: Check progress in toast notifications
2. **Pause if needed**: Use pause for breaks
3. **Save frequently**: Sessions auto-save, but be aware of storage
4. **Generate transcript after**: Don't generate during recording

### For Transcription Accuracy

1. **Clear audio**: Better audio = better transcription
2. **Multiple languages**: System handles Hindi/English mix
3. **Review transcript**: Always review for accuracy
4. **Edit if needed**: Transcripts can be manually edited (future feature)

## Troubleshooting

### Recording Issues

**Problem**: Microphone not working
- **Solution**: Check browser permissions, allow mic access

**Problem**: System audio not capturing
- **Solution**: Ensure "Share tab audio" is checked, use Chrome/Edge

**Problem**: Recording stops unexpectedly
- **Solution**: Check browser console for errors, verify internet connection

### Transcription Issues

**Problem**: Transcription fails
- **Solution**: Check Deepgram API key, verify audio chunks exist

**Problem**: Transcript is empty
- **Solution**: Ensure audio was recorded, check chunk uploads succeeded

**Problem**: Transcription is slow
- **Solution**: Normal for long sessions, wait 1-2 minutes

### Summary Issues

**Problem**: Summary generation fails
- **Solution**: Check Gemini API key, verify transcript exists

**Problem**: Summary is empty
- **Solution**: Ensure transcript was generated first

**Problem**: Wrong model error
- **Solution**: Check `GEMINI_MODEL_NAME` in `.env`, try different model

## Keyboard Shortcuts

Currently, the application uses mouse/touch interactions. Keyboard shortcuts may be added in future versions.

## Mobile Support

ScribeAI is optimized for desktop browsers. Mobile support is limited due to:
- System audio capture not available on mobile
- Limited MediaRecorder support
- Smaller screen size

**Recommendation**: Use desktop/laptop for best experience.

## Exporting Data

Currently, transcripts and summaries are viewable in the browser. Export functionality (PDF, TXT, etc.) may be added in future versions.

## Getting Help

If you encounter issues:
1. Check [PROBLEMS.md](./PROBLEMS.md) for common issues
2. Review browser console for error messages
3. Verify API keys are set correctly
4. Check network connection

For more technical details, see:
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [API.md](./API.md) - API documentation
- [SCALABILITY.md](./SCALABILITY.md) - Performance considerations

