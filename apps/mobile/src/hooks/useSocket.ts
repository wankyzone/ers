import { useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

export const useSocket = (url: string | null, accessToken: string | null) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Guard: don't create socket without url or accessToken
    if (!url || !accessToken) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    socketRef.current = io(url, {
      transports: ['websocket'],
      auth: {
        accessToken,
      },
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [url, accessToken]);

  return socketRef;
};