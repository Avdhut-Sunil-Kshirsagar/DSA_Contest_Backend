import express from 'express';
import { 
  getContests, 
  getContest, 
  createContest, 
  joinContest, 
  getContestLeaderboard,
  getMyContestResult 
} from '../controllers/contestController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getContests);
router.get('/:id', getContest);
router.get('/:id/leaderboard', getContestLeaderboard);

// Protected routes
router.post('/', authenticate, authorize('admin'), createContest);
router.post('/:id/join', authenticate, joinContest);
router.get('/:id/my-result', authenticate, getMyContestResult);

export default router;
