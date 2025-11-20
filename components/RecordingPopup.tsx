'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Mic, Monitor } from 'lucide-react'

interface RecordingPopupProps {
  open: boolean
  onClose: () => void
  onSelect: (mode: 'mic' | 'system') => void
  isLoading?: boolean
}

export function RecordingPopup({
  open,
  onClose,
  onSelect,
  isLoading = false,
}: RecordingPopupProps) {
  const [selectedMode, setSelectedMode] = useState<'mic' | 'system' | null>(
    null
  )

  const handleSelect = (mode: 'mic' | 'system') => {
    setSelectedMode(mode)
    onSelect(mode)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Recording Mode</DialogTitle>
          <DialogDescription>
            Choose how you want to record audio
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <Button
            variant="outline"
            size="lg"
            className="h-auto min-h-[120px] flex flex-col items-center justify-center gap-2 p-4"
            onClick={() => handleSelect('system')}
            disabled={isLoading}
          >
            <Monitor className="h-6 w-6" />
            <div className="text-center">
              <div className="font-semibold">Complete System Voice</div>
              <div className="text-sm text-muted-foreground">
                Record system audio + microphone (Google Meet, Zoom, etc.)
              </div>
              <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded text-left">
                <div className="font-medium mb-1">Important Steps:</div>
                <ol className="list-decimal list-inside space-y-1 text-[11px]">
                  <li>Select the tab/window with audio (e.g., Google Meet)</li>
                  <li>Check "Share tab audio" checkbox</li>
                  <li>Click "Share"</li>
                  <li>Allow microphone access when prompted</li>
                </ol>
                <div className="mt-1 text-[10px] italic">
                  Works best in Chrome/Edge
                </div>
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="h-20 flex flex-col items-center justify-center gap-2"
            onClick={() => handleSelect('mic')}
            disabled={isLoading}
          >
            <Mic className="h-6 w-6" />
            <div className="text-center">
              <div className="font-semibold">System Mic Only</div>
              <div className="text-sm text-muted-foreground">
                Record only from your microphone
              </div>
            </div>
          </Button>
        </div>
        {isLoading && (
          <div className="text-center text-sm text-muted-foreground">
            Requesting permissions...
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
