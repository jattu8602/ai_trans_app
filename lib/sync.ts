/**
 * Synchronization utilities for localStorage ↔ Database
 * Handles syncing session data between client cache and server
 */

import {
  getCachedSessions,
  cacheSessions,
  getLastSyncTime,
  getDeviceId,
} from './device'

// Re-export for use in hooks
export { getCachedSessions, cacheSessions, getLastSyncTime }

export interface SessionData {
  id: string
  title?: string | null
  transcript?: string | null
  summary?: string | null
  status: string
  duration?: number | null
  recordingStartedAt?: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Merges cached sessions with server sessions
 * Prioritizes server data for conflicts, but keeps local updates that haven't synced
 */
export function mergeSessions(
  cached: SessionData[],
  server: SessionData[]
): SessionData[] {
  const merged: SessionData[] = []
  const serverMap = new Map(server.map((s) => [s.id, s]))

  // Add all server sessions
  for (const serverSession of server) {
    merged.push(serverSession)
  }

  // Add cached sessions that aren't on server (newly created, not yet synced)
  for (const cachedSession of cached) {
    if (!serverMap.has(cachedSession.id)) {
      merged.push(cachedSession)
    }
  }

  // Sort by createdAt descending (newest first)
  return merged.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

/**
 * Syncs sessions from server to localStorage
 */
export async function syncFromServer(
  fetchSessions: () => Promise<SessionData[]>
): Promise<SessionData[]> {
  try {
    const serverSessions = await fetchSessions()
    const cachedSessions = getCachedSessions()
    const merged = mergeSessions(cachedSessions, serverSessions)
    cacheSessions(merged)
    return merged
  } catch (error) {
    console.error('Error syncing from server:', error)
    // Return cached sessions as fallback
    return getCachedSessions()
  }
}

/**
 * Syncs a single session to the server
 */
export async function syncSessionToServer(
  session: SessionData,
  syncFn: (session: SessionData) => Promise<SessionData>
): Promise<SessionData | null> {
  try {
    const synced = await syncFn(session)
    // Update cache with synced session
    const cached = getCachedSessions()
    const index = cached.findIndex((s) => s.id === session.id)
    if (index >= 0) {
      cached[index] = synced
    } else {
      cached.unshift(synced)
    }
    cacheSessions(cached)
    return synced
  } catch (error) {
    console.error('Error syncing session to server:', error)
    return null
  }
}

/**
 * Adds a new session to cache (optimistic update)
 * Will be synced to server later
 */
export function addSessionToCache(session: SessionData): void {
  const cached = getCachedSessions()
  cached.unshift(session)
  cacheSessions(cached)
}

/**
 * Updates a session in cache
 */
export function updateSessionInCache(session: SessionData): void {
  const cached = getCachedSessions()
  const index = cached.findIndex((s) => s.id === session.id)
  if (index >= 0) {
    cached[index] = session
  } else {
    cached.unshift(session)
  }
  cacheSessions(cached)
}

/**
 * Removes a session from cache
 */
export function removeSessionFromCache(sessionId: string): void {
  const cached = getCachedSessions()
  const filtered = cached.filter((s) => s.id !== sessionId)
  cacheSessions(filtered)
}

/**
 * Checks if sync is needed based on last sync time
 */
export function shouldSync(maxAgeMinutes: number = 5): boolean {
  const lastSync = getLastSyncTime()
  if (!lastSync) return true

  const now = new Date()
  const diffMinutes = (now.getTime() - lastSync.getTime()) / (1000 * 60)
  return diffMinutes > maxAgeMinutes
}

/**
 * Gets device ID for API requests
 * Throws error if called on server side
 */
export function getDeviceIdForSync(): string {
  try {
    return getDeviceId()
  } catch (error) {
    throw new Error(
      'Cannot get device ID on server side. Use this function only in client components.'
    )
  }
}
