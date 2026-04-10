import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config';

interface JwtPayload {
  id: string;
}

// Map userId -> Set of socketIds (user can have multiple tabs)
const onlineUsers = new Map<string, Set<string>>();

export function setupSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: [config.clientUrl, 'http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
    },
  });

  // Authenticate socket connections via JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
      (socket as any).userId = decoded.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId as string;

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    // Join a personal room for targeted messages
    socket.join(userId);

    // Broadcast online status
    io.emit('user:online', { userId });

    // Join a specific chat room
    socket.on('chat:join', (chatId: string) => {
      socket.join(`chat:${chatId}`);
    });

    // Leave a chat room
    socket.on('chat:leave', (chatId: string) => {
      socket.leave(`chat:${chatId}`);
    });

    // Handle new message — relay to other participants
    socket.on('chat:message', (data: { chatId: string; message: any; recipientId: string }) => {
      // Send to the chat room (all participants watching this chat)
      socket.to(`chat:${data.chatId}`).emit('chat:message', {
        chatId: data.chatId,
        message: data.message,
      });

      // Also notify the recipient directly (for unread badge updates if not in chat room)
      socket.to(data.recipientId).emit('chat:notification', {
        chatId: data.chatId,
        message: data.message,
        senderId: userId,
      });
    });

    // Typing indicators
    socket.on('chat:typing', (data: { chatId: string; recipientId: string }) => {
      socket.to(`chat:${data.chatId}`).emit('chat:typing', { userId, chatId: data.chatId });
    });

    socket.on('chat:stopTyping', (data: { chatId: string; recipientId: string }) => {
      socket.to(`chat:${data.chatId}`).emit('chat:stopTyping', { userId, chatId: data.chatId });
    });

    // Messages read
    socket.on('chat:read', (data: { chatId: string }) => {
      socket.to(`chat:${data.chatId}`).emit('chat:read', { chatId: data.chatId, userId });
    });

    // Get online users list
    socket.on('users:online', () => {
      const online = Array.from(onlineUsers.keys());
      socket.emit('users:online', online);
    });

    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit('user:offline', { userId });
        }
      }
    });
  });

  return io;
}
