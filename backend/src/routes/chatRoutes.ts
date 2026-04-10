import { Router } from 'express';
import { protect } from '../middleware/auth';
import { publicChat } from '../controllers/publicChatController';
import {
  getChatUsers,
  getOrCreateChat,
  sendMessage,
  getMyChats,
  markAsRead,
} from '../controllers/chatController';

const router = Router();

// Public chatbot endpoint used by frontend chatbot widget
router.post('/', publicChat);

// All routes require authentication
router.use(protect);

// GET /api/chat/users — list sellers/mechanics (for buyers) or chat partners
router.get('/users', getChatUsers);

// GET /api/chat/conversations — list user's chats
router.get('/conversations', getMyChats);

// GET /api/chat/:recipientId — get or create chat with a user
router.get('/:recipientId', getOrCreateChat);

// POST /api/chat/:chatId/messages — send a message
router.post('/:chatId/messages', sendMessage);

// PUT /api/chat/:chatId/read — mark messages as read
router.put('/:chatId/read', markAsRead);

export default router;
