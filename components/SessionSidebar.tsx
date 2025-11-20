'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Plus, Clock, CheckCircle2, PauseCircle, Radio } from 'lucide-react'
import { useSessions } from '@/hooks/useSessions'
import { formatDistanceToNow } from 'date-fns'

interface SessionSidebarProps {
  onRecordNew: () => void
  onSelectSession?: (sessionId: string) => void
}

export function SessionSidebar({
  onRecordNew,
  onSelectSession,
}: SessionSidebarProps) {
  // In development, only fetch 2 sessions for faster loading
  const isDevelopment = process.env.NODE_ENV === 'development'
  const limit = isDevelopment ? 2 : undefined
  const { sessions, isLoading } = useSessions(limit)

  // Sessions are already sorted by createdAt DESC (newest first) from API
  const displaySessions = sessions

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'recording':
        return <Radio className="h-4 w-4 text-red-500 animate-pulse" />
      case 'paused':
        return <PauseCircle className="h-4 w-4 text-yellow-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const formatDuration = (seconds: number | null | undefined): string => {
    if (!seconds) return '0:00'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="w-80 border-r bg-muted/40 flex flex-col h-screen">
      <div className="p-4 border-b">
        <Button onClick={onRecordNew} className="w-full gap-2" size="lg">
          <Plus className="h-5 w-5" />
          Record New
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="text-lg font-semibold mb-4">Session History</h2>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">
            Loading sessions...
          </div>
        ) : displaySessions.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No sessions yet. Start recording to create your first session.
          </div>
        ) : (
          <div className="space-y-2">
            {displaySessions.map((session) => (
              <Card
                key={session.id}
                className="p-4 cursor-pointer hover:bg-accent transition-colors"
                onClick={() => onSelectSession?.(session.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {session.title || 'Untitled Session'}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(session.createdAt), {
                        addSuffix: true,
                      })}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      {getStatusIcon(session.status)}
                      <span className="capitalize">{session.status}</span>
                      {session.duration && (
                        <>
                          <span>•</span>
                          <span>{formatDuration(session.duration)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
