import { useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

export const useSocket = (url: string) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!url) return;

    socketRef.current = io(url, {
      transports: ['websocket'],
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [url]);

  return socketRef;
};