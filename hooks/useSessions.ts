'use client'

import { useState, useEffect, useCallback } from 'react'
import { getDeviceId } from '@/lib/device'
import {
  getCachedSessions,
  addSessionToCache,
  updateSessionInCache,
  removeSessionFromCache,
  syncFromServer,
  syncSessionToServer,
  shouldSync,
  type SessionData,
} from '@/lib/sync'

interface UseSessionsReturn {
  sessions: SessionData[]
  isLoading: boolean
  error: string | null
  createSession: (title?: string) => Promise<SessionData | null>
  updateSession: (session: SessionData) => Promise<SessionData | null>
  deleteSession: (sessionId: string) => Promise<boolean>
  syncSessions: () => Promise<void>
  refreshSessions: () => Promise<void>
}

/**
 * React hook for session management with localStorage caching and DB sync
 * @param limit - Optional limit for number of sessions to fetch from server
 */
export function useSessions(limit?: number): UseSessionsReturn {
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch sessions from server
  const fetchSessions = useCallback(async (): Promise<SessionData[]> => {
    try {
      const deviceId = getDeviceId()
      const url = limit
        ? `/api/sessions?deviceId=${deviceId}&limit=${limit}`
        : `/api/sessions?deviceId=${deviceId}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to fetch sessions')
      }

      const data = await response.json()
      return data.sessions.map((s: any) => ({
        id: s.id,
        title: s.title,
        transcript: s.transcript,
        summary: s.summary,
        status: s.status,
        duration: s.duration,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }))
    } catch (err) {
      console.error('Error fetching sessions:', err)
      throw err
    }
  }, [limit])

  // Load sessions on mount
  useEffect(() => {
    const loadSessions = async () => {
      try {
        setError(null)

        // Load from cache first (instant) - show immediately
        const cached = getCachedSessions()
        setSessions(cached)
        setIsLoading(false) // Don't block UI - show cached data immediately

        // Sync from server in background
        if (shouldSync(5)) {
          const synced = await syncFromServer(fetchSessions)
          setSessions(synced)
        } else {
          // Still fetch to ensure we have latest, but don't wait
          fetchSessions()
            .then((serverSessions) => {
              setSessions(serverSessions)
            })
            .catch(console.error)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        // Fallback to cached sessions
        const cached = getCachedSessions()
        setSessions(cached)
        setIsLoading(false) // Ensure loading is false even on error
      }
    }

    loadSessions()
  }, [fetchSessions])

  // Create a new session
  const createSession = useCallback(
    async (title?: string): Promise<SessionData | null> => {
      try {
        const deviceId = getDeviceId()

        // Create optimistic session
        const optimisticSession: SessionData = {
          id: `temp-${Date.now()}`,
          title: title || null,
          transcript: null,
          summary: null,
          status: 'pending',
          duration: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        // Add to cache immediately
        addSessionToCache(optimisticSession)
        setSessions((prev) => [optimisticSession, ...prev])

        // Create on server
        const response = await fetch('/api/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceId,
            title,
            status: 'pending',
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to create session')
        }

        const data = await response.json()
        const serverSession: SessionData = {
          id: data.session.id,
          title: data.session.title,
          transcript: data.session.transcript,
          summary: data.session.summary,
          status: data.session.status,
          duration: data.session.duration,
          createdAt: data.session.createdAt,
          updatedAt: data.session.updatedAt,
        }

        // Update cache with server session
        updateSessionInCache(serverSession)
        setSessions((prev) =>
          prev.map((s) => (s.id === optimisticSession.id ? serverSession : s))
        )

        return serverSession
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        console.error('Error creating session:', err)
        return null
      }
    },
    []
  )

  // Update a session
  const updateSession = useCallback(
    async (session: SessionData): Promise<SessionData | null> => {
      try {
        // Update cache immediately
        updateSessionInCache(session)
        setSessions((prev) =>
          prev.map((s) => (s.id === session.id ? session : s))
        )

        // Sync to server
        const synced = await syncSessionToServer(session, async (s) => {
          const deviceId = getDeviceId()
          const response = await fetch(`/api/sessions/${s.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              deviceId,
              title: s.title,
              transcript: s.transcript,
              summary: s.summary,
              status: s.status,
              duration: s.duration,
            }),
          })

          if (!response.ok) {
            throw new Error('Failed to update session')
          }

          const data = await response.json()
          return {
            id: data.session.id,
            title: data.session.title,
            transcript: data.session.transcript,
            summary: data.session.summary,
            status: data.session.status,
            duration: data.session.duration,
            createdAt: data.session.createdAt,
            updatedAt: data.session.updatedAt,
          }
        })

        if (synced) {
          setSessions((prev) =>
            prev.map((s) => (s.id === synced.id ? synced : s))
          )
        }

        return synced
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        console.error('Error updating session:', err)
        return null
      }
    },
    []
  )

  // Delete a session
  const deleteSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        // Remove from cache immediately
        removeSessionFromCache(sessionId)
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))

        // Delete on server
        const deviceId = getDeviceId()
        const response = await fetch(
          `/api/sessions/${sessionId}?deviceId=${deviceId}`,
          {
            method: 'DELETE',
          }
        )

        if (!response.ok) {
          throw new Error('Failed to delete session')
        }

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        console.error('Error deleting session:', err)
        // Restore session on error
        const cached = getCachedSessions()
        setSessions(cached)
        return false
      }
    },
    []
  )

  // Sync sessions from server
  const syncSessions = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const synced = await syncFromServer(fetchSessions)
      setSessions(synced)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Error syncing sessions:', err)
    } finally {
      setIsLoading(false)
    }
  }, [fetchSessions])

  // Refresh sessions (force fetch from server)
  const refreshSessions = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const serverSessions = await fetchSessions()
      setSessions(serverSessions)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Error refreshing sessions:', err)
    } finally {
      setIsLoading(false)
    }
  }, [fetchSessions])

  return {
    sessions,
    isLoading,
    error,
    createSession,
    updateSession,
    deleteSession,
    syncSessions,
    refreshSessions,
  }
}
