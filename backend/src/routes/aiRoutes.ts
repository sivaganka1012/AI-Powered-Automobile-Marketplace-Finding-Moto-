import { Router } from 'express';
import { protect } from '../middleware/auth';
import { askAI } from '../controllers/aiController';
import { askGeminiAdvanced } from '../controllers/geminiController';

const router = Router();

router.use(protect);
router.post('/chat', askAI);
router.post('/gemini/chat', askGeminiAdvanced);

export default router;
