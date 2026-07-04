import { io, Socket } from 'socket.io-client';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL!;

let socket: Socket;

export function connectSocket(userId: string) {
  socket = io(BASE_URL, {
    transports: ['websocket'],
  });

  socket?.emit('join:user', userId);

  return socket;
}

export function getSocket() {
  return socket;
}