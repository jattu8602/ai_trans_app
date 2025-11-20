'use client'

import { useState, useEffect } from 'react'
import { getDeviceId, getDeviceIdOrNull } from '@/lib/device'

interface User {
  id: string
  deviceId: string
  name: string | null
  lastSyncedAt: string | null
  createdAt: string
  updatedAt: string
}

interface DeviceData {
  deviceId: string | null
  user: User | null
  isLoading: boolean
  error: string | null
  initialize: () => Promise<void>
}

/**
 * React hook for device ID management
 * Handles device ID generation, user creation/fetching, and initialization
 */
export function useDevice(): DeviceData {
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const initialize = async () => {
    try {
      setError(null)

      // Get device ID (always use getDeviceId() to ensure we have the latest)
      const id = getDeviceId()

      // Fetch or create user (background operation)
      const response = await fetch('/api/users/device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceId: id }),
      })

      if (!response.ok) {
        throw new Error('Failed to initialize user')
      }

      const data = await response.json()
      setUser(data.user)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Error initializing device:', err)
      // Don't throw - this is a background operation
    }
  }

  useEffect(() => {
    // Check if device ID exists
    const existingId = getDeviceIdOrNull()
    if (existingId) {
      // Set deviceId immediately (non-blocking)
      setDeviceId(existingId)
      setIsLoading(false) // Don't block - deviceId is available
      // Initialize user in background
      initialize().catch(console.error)
    } else {
      // Generate new device ID immediately
      const id = getDeviceId()
      setDeviceId(id)
      setIsLoading(false) // Don't block - deviceId is available
      // Initialize user in background
      initialize().catch(console.error)
    }
  }, [])

  return {
    deviceId,
    user,
    isLoading,
    error,
    initialize,
  }
}

