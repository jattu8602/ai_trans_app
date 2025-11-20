'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

export interface UseSocketReturn {
  socket: Socket | null
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  emit: (event: string, data: unknown) => void
  on: (event: string, callback: (...args: any[]) => void) => void
  off: (event: string, callback?: (...args: any[]) => void) => void
  joinSession: (sessionId: string) => void
  leaveSession: (sessionId: string) => void
}

/**
 * React hook for Socket.io client connection
 * Handles connection, reconnection, and event management
 */
export function useSocket(): UseSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // Initialize Socket.io client
    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')

    console.log('[useSocket] Connecting to:', socketUrl)

    setIsConnecting(true)
    setError(null)

    const newSocket = io(socketUrl, {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    })

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('[useSocket] Connected:', newSocket.id)
      setIsConnected(true)
      setIsConnecting(false)
      setError(null)
    })

    newSocket.on('disconnect', (reason) => {
      console.log('[useSocket] Disconnected:', reason)
      setIsConnected(false)
      if (reason === 'io server disconnect') {
        // Server disconnected, reconnect manually
        newSocket.connect()
      }
    })

    newSocket.on('connect_error', (err) => {
      console.error('[useSocket] Connection error:', err)
      setError(err.message)
      setIsConnecting(false)
    })

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('[useSocket] Reconnected after', attemptNumber, 'attempts')
      setIsConnected(true)
      setIsConnecting(false)
      setError(null)
    })

    newSocket.on('reconnect_attempt', () => {
      console.log('[useSocket] Reconnection attempt...')
      setIsConnecting(true)
    })

    newSocket.on('reconnect_failed', () => {
      console.error('[useSocket] Reconnection failed')
      setError('Failed to reconnect to server')
      setIsConnecting(false)
    })

    socketRef.current = newSocket
    setSocket(newSocket)

    // Cleanup on unmount
    return () => {
      console.log('[useSocket] Cleaning up socket connection')
      newSocket.close()
      socketRef.current = null
      setSocket(null)
      setIsConnected(false)
      setIsConnecting(false)
    }
  }, [])

  // Emit event
  const emit = useCallback((event: string, data: unknown) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(event, data)
    } else {
      console.warn('[useSocket] Cannot emit - socket not connected:', event)
    }
  }, [])

  // Listen to event
  const on = useCallback(
    (event: string, callback: (...args: any[]) => void) => {
      if (socketRef.current) {
        socketRef.current.on(event, callback)
      }
    },
    []
  )

  // Remove event listener
  const off = useCallback(
    (event: string, callback?: (...args: any[]) => void) => {
      if (socketRef.current) {
        if (callback) {
          socketRef.current.off(event, callback)
        } else {
          socketRef.current.off(event)
        }
      }
    },
    []
  )

  // Join session room
  const joinSession = useCallback(
    (sessionId: string) => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('session:join', sessionId)
        console.log('[useSocket] Joined session:', sessionId)
      }
    },
    []
  )

  // Leave session room
  const leaveSession = useCallback(
    (sessionId: string) => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('session:leave', sessionId)
        console.log('[useSocket] Left session:', sessionId)
      }
    },
    []
  )

  return {
    socket,
    isConnected,
    isConnecting,
    error,
    emit,
    on,
    off,
    joinSession,
    leaveSession,
  }
}

