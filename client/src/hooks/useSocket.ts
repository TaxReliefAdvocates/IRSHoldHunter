import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// In production (same origin), connect to current host. In dev, use localhost.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3000');

let socketInstance: Socket | null = null;

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Create singleton socket instance
    if (!socketInstance) {
      socketInstance = io(SOCKET_URL, {
        // WebSocket only - no polling (faster, more reliable)
        transports: ['websocket'],
        // Reconnection settings
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
        // Connection timeout
        timeout: 20000,
      });

      socketInstance.on('connect', () => {
        console.log('✅ Socket connected via WebSocket');
        setIsConnected(true);
      });

      socketInstance.on('disconnect', () => {
        console.log('❌ Socket disconnected');
        setIsConnected(false);
      });

      socketInstance.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });
    }

    setSocket(socketInstance);

    return () => {
      // Don't disconnect on unmount - keep connection alive
    };
  }, []);

  return { socket, isConnected };
}
