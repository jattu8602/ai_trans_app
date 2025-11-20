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
      setIsLoading(true)
      setError(null)

      // Get or create device ID
      const id = getDeviceId()
      setDeviceId(id)

      // Fetch or create user
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
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Check if device ID exists
    const existingId = getDeviceIdOrNull()
    if (existingId) {
      setDeviceId(existingId)
      // Initialize user in background
      initialize()
    } else {
      // Generate new device ID and initialize
      initialize()
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

