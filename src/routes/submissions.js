import express from 'express';
import { 
  submitSolution, 
  getContestSubmissions, 
  getSubmission,
  submitFinalResults
} from '../controllers/submissionController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(authenticate);

router.post('/', submitSolution);
router.post('/final', submitFinalResults);
router.get('/contest/:contestId', getContestSubmissions);
router.get('/:id', getSubmission);

export default router;
