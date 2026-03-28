import { Router } from 'express';
import authRoutes from './auth.routes';
import emailRoutes from './email.routes';
import aiRoutes from './ai.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/emails', emailRoutes);
router.use('/ai', aiRoutes);

export default router;
