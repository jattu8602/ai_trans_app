'use client'

import { useRouter, usePathname } from 'next/navigation'
import { SessionSidebar } from './SessionSidebar'

interface LayoutWrapperProps {
  children: React.ReactNode
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleRecordNew = () => {
    // Navigate to home page - recording logic is handled there
    if (pathname !== '/') {
      router.push('/')
    }
  }

  const handleSelectSession = (sessionId: string) => {
    router.push(`/sessions/${sessionId}`)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <SessionSidebar
        onRecordNew={handleRecordNew}
        onSelectSession={handleSelectSession}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
