import { Response } from 'express';
import config from '../config';
import { AuthRequest } from '../middleware/auth';
import { GeminiMemoryManager } from '../utils/geminiMemory';
import {
  createGeminiService,
  evaluateGeminiPolicy,
  GeminiUserRole,
  sanitizeGeminiMessage,
} from '../utils/geminiService';

const memory = new GeminiMemoryManager();

const toSessionId = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const sessionId = value.trim().slice(0, 120);
  return sessionId || undefined;
};

const allowedRoles: GeminiUserRole[] = ['buyer', 'mechanic', 'seller'];

const isGeminiRole = (role: string | undefined): role is GeminiUserRole => {
  return !!role && allowedRoles.includes(role as GeminiUserRole);
};

export const askGeminiAdvanced = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rawRole = req.user?.role;
    if (!isGeminiRole(rawRole)) {
      res.status(403).json({ success: false, message: 'Gemini chat is available only for buyer, mechanic, and seller roles.' });
      return;
    }

    const message = sanitizeGeminiMessage(String(req.body?.message || ''));
    if (!message) {
      res.status(400).json({ success: false, message: 'Message is required' });
      return;
    }

    if (!config.geminiApiKey) {
      res.status(503).json({ success: false, message: 'GEMINI_API_KEY is missing in server environment.' });
      return;
    }

    const payloadSession = toSessionId(req.body?.sessionId);
    const headerSession = toSessionId(req.header('x-session-id'));
    const sessionKey = `${rawRole}:${payloadSession || headerSession || req.ip}`;

    memory.addUserMessage(sessionKey, message);

    const policyResult = evaluateGeminiPolicy(message, rawRole);
    if (!policyResult.allowed) {
      const fallbackReply = policyResult.fallbackReply || 'This chatbot only supports bike and bike spare parts topics.';
      memory.addBotReply(sessionKey, fallbackReply);
      res.json({ success: true, data: { reply: fallbackReply } });
      return;
    }

    const service = createGeminiService(config.geminiApiKey);
    const reply = await service.generateReply(message, rawRole, memory.getSnapshot(sessionKey));

    memory.addBotReply(sessionKey, reply);
    res.json({ success: true, data: { reply } });
  } catch (error) {
    console.error('askGeminiAdvanced error:', error);
    res.status(502).json({ success: false, message: 'Unable to process your request right now. Please try again later.' });
  }
};