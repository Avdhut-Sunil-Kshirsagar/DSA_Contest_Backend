import ContestResult from '../models/ContestResult.js';
import Problem from '../models/Problem.js';
import Contest from '../models/Contest.js';
import { CodeRunner } from '../utils/codeRunner.js';

const codeRunner = new CodeRunner();

// @desc    Submit solution
// @route   POST /api/submissions
// @access  Private
export const submitSolution = async (req, res) => {
  try {
    const { contestId, problemId, code, language } = req.body;
    const userId = req.user.id;

    // Check if contest exists and is active
    const contest = await Contest.findById(contestId);
    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found'
      });
    }

    // Check if contest is currently running
    const now = new Date();
    if (now < contest.startTime || now > contest.endTime) {
      return res.status(400).json({
        success: false,
        message: 'Contest is not currently running'
      });
    }

    // Check if problem exists in contest
    const problemInContest = (Array.isArray(contest.problems) ? contest.problems : []).find(p => p.problemId.toString() === problemId);
    const pointsForProblem = problemInContest ? problemInContest.points : (await Problem.findById(problemId))?.points || 100;
    
    if (!problemInContest) {
      return res.status(400).json({
        success: false,
        message: 'Problem not found in this contest'
      });
    }

    // Get problem details with test cases
    const problem = await Problem.findById(problemId);
    if (!problem) {
      return res.status(404).json({
        success: false,
        message: 'Problem not found'
      });
    }

    // Run code against test cases
    try {
      const combinedCode = combineWithHarness(code, language, problem);
      const testResults = await codeRunner.runCode(combinedCode, language, problem.testCases);

      // Update submission with results
      // Score is calculated as the sum of points for each passed test case (from DB)
      const perTestPoints = Array.isArray(problem.testCases)
        ? problem.testCases.map(tc => Number(tc.points) || 0)
        : [];
      const maxScore = perTestPoints.reduce((s, p) => s + p, 0);
      const score = testResults.reduce((sum, r, idx) => {
        const pts = perTestPoints[idx] || 0;
        return sum + (r.passed ? pts : 0);
      }, 0);

      // Update contest result
      await updateContestResult(userId, contestId, problemId, {
        score,
        totalExecutionTime: testResults.reduce((s, r) => s + (r.executionTime || 0), 0),
        status: score === maxScore ? 'accepted' : (score > 0 ? 'partial' : 'attempted')
      });

      res.status(200).json({
        success: true,
        message: 'Solution submitted successfully',
        data: {
          status: score === maxScore ? 'accepted' : (score > 0 ? 'partial' : 'attempted'),
          score,
          maxScore,
          testResults,
          totalExecutionTime: testResults.reduce((s, r) => s + (r.executionTime || 0), 0)
        }
      });

    } catch (executionError) {
      res.status(200).json({
        success: true,
        message: 'Solution submitted with errors',
        data: {
          status: 'runtime_error',
          score: 0,
          maxScore: problemInContest.points,
          error: executionError.message
        }
      });
    }

  } catch (error) {
    console.error('Submit solution error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit solution',
      error: error.message
    });
  }
};

// @desc    Get user submissions for a contest
// @route   GET /api/submissions/contest/:contestId
// @access  Private
export const getContestSubmissions = async (req, res) => {
  try {
    const { contestId } = req.params;
    const userId = req.user.id;
    // No per-attempt persistence; respond with empty list for compatibility
    const submissions = [];

    res.status(200).json({
      success: true,
      data: submissions
    });
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions',
      error: error.message
    });
  }
};

// @desc    Get single submission
// @route   GET /api/submissions/:id
// @access  Private
export const getSubmission = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: null
    });
  } catch (error) {
    console.error('Get submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submission',
      error: error.message
    });
  }
};

// @desc    Submit final contest results
// @route   POST /api/submissions/final
// @access  Private
export const submitFinalResults = async (req, res) => {
  try {
    const { userId, contestId, totalScore, penaltyPoints, problemResults, totalTime } = req.body;
    const authenticatedUserId = req.user.id;

    // Verify user ID matches authenticated user
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if contest exists
    const contest = await Contest.findById(contestId);
    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found'
      });
    }

    // Create or update contest result
    let contestResult = await ContestResult.findOne({ userId, contestId });
    
    if (!contestResult) {
      contestResult = await ContestResult.create({
        userId,
        contestId,
        problemResults: contest.problems.map(p => ({
          problemId: p.problemId,
          maxScore: p.points,
          status: 'not_attempted'
        }))
      });
    }

    // Helper to parse HH:MM:SS into milliseconds; also accept numeric seconds/ms
    const parseDurationToMs = (value) => {
      if (value == null) return 0;
      if (typeof value === 'number' && !Number.isNaN(value)) {
        // Assume already milliseconds if large, otherwise seconds
        return value > 3600 ? Math.floor(value) : Math.floor(value * 1000);
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        // If plain number string
        if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
          const num = Number(trimmed);
          return num > 3600 ? Math.floor(num) : Math.floor(num * 1000);
        }
        // HH:MM:SS
        const parts = trimmed.split(':').map((p) => Number(p));
        if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
          const [hh, mm, ss] = parts;
          return ((hh * 3600) + (mm * 60) + ss) * 1000;
        }
      }
      return 0;
    };

    // Update final results
    contestResult.totalScore = Number(totalScore) || 0;
    contestResult.penalties = Number(penaltyPoints) || 0;
    contestResult.totalTime = parseDurationToMs(totalTime);
    contestResult.completedAt = new Date();
    contestResult.isCompleted = true;

    // Update individual problem results
    (Array.isArray(problemResults) ? problemResults : []).forEach(problemResult => {
      contestResult.updateProblemResult(
        problemResult.problemId,
        Number(problemResult.score) || 0,
        0, // execution time not available in final submission
        (Number(problemResult.score) || 0) > 0 ? 'accepted' : 'attempted',
        false
      );
    });

    await contestResult.save();

    // We do not persist per-problem submissions

    // Helper to format milliseconds to HH:MM:SS
    const formatMsToHHMMSS = (ms) => {
      const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
      const hh = Math.floor(totalSeconds / 3600);
      const mm = Math.floor((totalSeconds % 3600) / 60);
      const ss = totalSeconds % 60;
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
    };

    res.status(200).json({
      success: true,
      message: 'Final results submitted successfully',
      data: {
        contestResultId: contestResult._id,
        totalScore: totalScore,
        penaltyPoints: penaltyPoints,
        totalTime: formatMsToHHMMSS(contestResult.totalTime),
        completedAt: contestResult.completedAt
      }
    });

  } catch (error) {
    console.error('Submit final results error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit final results',
      error: error.message
    });
  }
};

// Helper function to update contest result
async function updateContestResult(userId, contestId, problemId, submission) {
  try {
    let contestResult = await ContestResult.findOne({ userId, contestId });
    
    if (!contestResult) {
      // Create new contest result if it doesn't exist
      const contest = await Contest.findById(contestId);
      const problemIds = (Array.isArray(contest?.problems) ? contest.problems : []).map(p => p.problemId);
      const problemDocs = await Problem.find({ _id: { $in: problemIds } }, { testCases: 1, points: 1 });
      const probMap = new Map(problemDocs.map(p => [String(p._id), p]));
      contestResult = await ContestResult.create({
        userId,
        contestId,
        problemResults: (Array.isArray(contest?.problems) ? contest.problems : []).map(p => {
          const full = probMap.get(String(p.problemId));
          let maxScore = Number(p.points) || 0;
          if (full && Array.isArray(full.testCases) && full.testCases.length > 0) {
            maxScore = full.testCases.reduce((s, tc) => s + (Number(tc.points) || 0), 0);
          } else if (full && typeof full.points === 'number') {
            maxScore = Number(full.points) || 0;
          }
          return {
            problemId: p.problemId,
            maxScore,
            status: 'not_attempted'
          };
        })
      });
    }

    // Update problem result
    const isFirstAccept = submission.status === 'accepted';
    
    const status = submission.status === 'accepted' ? 'accepted' : 
                  submission.score > 0 ? 'partial' : 'attempted';

    contestResult.updateProblemResult(
      problemId,
      submission.score,
      submission.totalExecutionTime,
      status,
      isFirstAccept
    );

    await contestResult.save();
  } catch (error) {
    console.error('Update contest result error:', error);
  }
}

function combineWithHarness(userCode, language, problem) {
  let harness = '';
  const raw = problem?.harshnessCode ?? problem?.harnessCode ?? '';
  
  // Handle both harshnessCode and harnessCode fields
  if (typeof raw === 'object' && raw !== null) {
    harness = String(raw[language] || '').trim();
  } else {
    harness = String(raw || '').trim();
  }
  
  // If no harness code, return user code as is
  if (!harness) return userCode;
  
  // Combine user code with harness code
  if (language === 'javascript') {
    return `${userCode}
// --- HARNESS START ---
${harness}
// --- HARNESS END ---`;
  }
  if (language === 'python') {
    return `${userCode}
# --- HARNESS START ---
${harness}
# --- HARNESS END ---`;
  }
  if (language === 'cpp') {
    return `${userCode}
// --- HARNESS START ---
${harness}
// --- HARNESS END ---`;
  }
  if (language === 'java') {
    return `${userCode}
// --- HARNESS START ---
${harness}
// --- HARNESS END ---`;
  }
  
  return userCode;
}
