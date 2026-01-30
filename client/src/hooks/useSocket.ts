import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// Connect to API server (not the static site origin)
const SOCKET_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD ? 'https://irs-hold-hunter-api.onrender.com' : 'http://localhost:3000');

let socketInstance: Socket | null = null;

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Create singleton socket instance
    if (!socketInstance) {
      socketInstance = io(SOCKET_URL, {
        // Allow both transports for better compatibility
        transports: ['polling', 'websocket'],
        upgrade: true,
        // Reconnection settings (AGGRESSIVE for stability)
        reconnection: true,
        reconnectionDelay: 500, // Try reconnecting every 500ms
        reconnectionDelayMax: 2000, // Max 2s between attempts
        reconnectionAttempts: Infinity,
        // INCREASED timeout to match server
        timeout: 60000, // 60s (was 20s)
      });

      socketInstance.on('connect', () => {
        console.log('✅ Socket connected');
        setIsConnected(true);
      });

      socketInstance.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);
        setIsConnected(false);
        
        // Auto-reconnect if disconnected by server
        if (reason === 'io server disconnect' || reason === 'transport close') {
          console.log('🔄 Forcing reconnect...');
          socketInstance?.connect();
        }
      });

      socketInstance.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });
      
      socketInstance.on('reconnect', (attemptNumber) => {
        console.log(`✅ Socket reconnected after ${attemptNumber} attempts`);
      });
      
      socketInstance.on('reconnect_attempt', (attemptNumber) => {
        if (attemptNumber % 5 === 0) { // Log every 5 attempts
          console.log(`🔄 Reconnect attempt #${attemptNumber}...`);
        }
      });
    }

    setSocket(socketInstance);

    return () => {
      // Don't disconnect on unmount - keep connection alive
    };
  }, []);

  return { socket, isConnected };
}
