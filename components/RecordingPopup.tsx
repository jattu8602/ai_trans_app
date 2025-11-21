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
      <DialogContent className="sm:max-w-lg border-0 bg-gradient-to-br from-background to-muted/20">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Select Recording Mode
          </DialogTitle>
          <DialogDescription className="text-base">
            Choose how you want to record audio
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-6">
          <Button
            variant="outline"
            size="lg"
            className="relative h-auto min-h-[120px] flex flex-col items-center justify-center gap-3 p-6 border-2 hover:border-primary hover:bg-primary/5 hover:shadow-lg transition-all duration-300 group overflow-hidden"
            onClick={() => handleSelect('system')}
            disabled={isLoading}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10 flex flex-col items-center gap-3 w-full">
              <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300">
                <Monitor className="h-7 w-7 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <div className="font-bold text-lg">Complete System Voice</div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  Record system audio + microphone (Google Meet, Zoom, etc.)
                </div>
                <div className="text-xs text-muted-foreground mt-3 p-3 bg-muted/50 backdrop-blur-sm rounded-lg text-left border border-border/50">
                  <div className="font-semibold mb-2 text-foreground flex items-center gap-1">
                    <span className="text-primary">•</span> Important Steps:
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-[11px] ml-1">
                    <li>
                      Select the tab/window with audio (e.g., Google Meet)
                    </li>
                    <li>Check "Share tab audio" checkbox</li>
                    <li>Click "Share"</li>
                    <li>Allow microphone access when prompted</li>
                  </ol>
                  <div className="mt-2 pt-2 border-t border-border/50 text-[10px] italic text-muted-foreground/80">
                    ⚡ Works best in Chrome/Edge
                  </div>
                </div>
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="relative h-24 flex flex-col items-center justify-center gap-3 border-2 hover:border-primary hover:bg-primary/5 hover:shadow-lg transition-all duration-300 group overflow-hidden"
            onClick={() => handleSelect('mic')}
            disabled={isLoading}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300">
                <Mic className="h-7 w-7 text-primary" />
              </div>
              <div className="text-center">
                <div className="font-bold text-lg">System Mic Only</div>
                <div className="text-sm text-muted-foreground">
                  Record only from your microphone
                </div>
              </div>
            </div>
          </Button>
        </div>
        {isLoading && (
          <div className="text-center py-3">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
              <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
              Requesting permissions...
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
