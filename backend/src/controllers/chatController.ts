import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Chat from '../models/Chat';
import User from '../models/User';
import mongoose from 'mongoose';

// Get list of sellers & mechanics that the buyer can chat with
// OR get buyers who have chatted with the seller/mechanic
export const getChatUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;
    const role = req.user!.role;

    if (role === 'buyer') {
      // Buyers can browse approved sellers and mechanics
      const users = await User.find({
        role: { $in: ['seller', 'mechanic'] },
        isActive: true,
        approvalStatus: 'approved',
      }).select('firstName lastName role avatar shopName workshopName specialization');

      res.json(users);
    } else {
      // Sellers/Mechanics: return users they have open conversations with
      const chats = await Chat.find({ participants: userId })
        .sort({ updatedAt: -1 })
        .populate('participants', 'firstName lastName role avatar shopName workshopName specialization');

      const users = chats.map((chat) => {
        const other = chat.participants.find(
          (p: any) => p._id.toString() !== userId.toString()
        );
        const unreadCount = chat.messages.filter(
          (m) => m.sender.toString() !== userId.toString() && !m.read
        ).length;
        return { user: other, chatId: chat._id, lastMessage: chat.lastMessage, unreadCount };
      });

      res.json(users);
    }
  } catch (error) {
    console.error('getChatUsers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get or create a chat between two users
export const getOrCreateChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;
    const { recipientId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      res.status(400).json({ message: 'Invalid recipient ID' });
      return;
    }

    if (userId.toString() === recipientId) {
      res.status(400).json({ message: 'Cannot chat with yourself' });
      return;
    }

    // Check recipient exists
    const recipient = await User.findById(recipientId).select('firstName lastName role avatar shopName workshopName specialization');
    if (!recipient) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Find existing chat
    let chat = await Chat.findOne({
      participants: { $all: [userId, recipientId], $size: 2 },
    });

    if (!chat) {
      chat = await Chat.create({
        participants: [userId, recipientId],
        messages: [],
      });
    }

    // Mark messages from recipient as read
    let modified = false;
    chat.messages.forEach((msg) => {
      if (msg.sender.toString() === recipientId && !msg.read) {
        msg.read = true;
        modified = true;
      }
    });
    if (modified) await chat.save();

    res.json({ chat, recipient });
  } catch (error) {
    console.error('getOrCreateChat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Send a message
export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;
    const { chatId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ message: 'Message content is required' });
      return;
    }

    if (content.length > 2000) {
      res.status(400).json({ message: 'Message is too long (max 2000 characters)' });
      return;
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      res.status(404).json({ message: 'Chat not found' });
      return;
    }

    // Verify user is a participant
    const isParticipant = chat.participants.some(
      (p) => p.toString() === userId.toString()
    );
    if (!isParticipant) {
      res.status(403).json({ message: 'Not authorized' });
      return;
    }

    const message = {
      sender: userId,
      content: content.trim(),
      read: false,
      createdAt: new Date(),
    };

    chat.messages.push(message as any);
    chat.lastMessage = {
      content: content.trim(),
      sender: userId,
      createdAt: new Date(),
    };

    await chat.save();

    const savedMessage = chat.messages[chat.messages.length - 1];

    res.status(201).json(savedMessage);
  } catch (error) {
    console.error('sendMessage error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user's conversations list
export const getMyChats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;

    const chats = await Chat.find({ participants: userId })
      .sort({ updatedAt: -1 })
      .populate('participants', 'firstName lastName role avatar shopName workshopName specialization');

    const result = chats.map((chat) => {
      const other = chat.participants.find(
        (p: any) => p._id.toString() !== userId.toString()
      );
      const unreadCount = chat.messages.filter(
        (m) => m.sender.toString() !== userId.toString() && !m.read
      ).length;
      return {
        chatId: chat._id,
        user: other,
        lastMessage: chat.lastMessage,
        unreadCount,
        updatedAt: chat.updatedAt,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('getMyChats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Mark messages as read
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      res.status(404).json({ message: 'Chat not found' });
      return;
    }

    const isParticipant = chat.participants.some(
      (p) => p.toString() === userId.toString()
    );
    if (!isParticipant) {
      res.status(403).json({ message: 'Not authorized' });
      return;
    }

    let modified = false;
    chat.messages.forEach((msg) => {
      if (msg.sender.toString() !== userId.toString() && !msg.read) {
        msg.read = true;
        modified = true;
      }
    });

    if (modified) await chat.save();

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('markAsRead error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
