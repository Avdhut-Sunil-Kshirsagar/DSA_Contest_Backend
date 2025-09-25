import Contest from '../models/Contest.js';
import ContestResult from '../models/ContestResult.js';
import Problem from '../models/Problem.js';
// Simplified to align with minimal DB shape

// @desc    Get all contests
// @route   GET /api/contests
// @access  Public
export const getContests = async (req, res) => {
  try {
    const contests = await Contest.find({}).sort({ startTime: -1 });

    res.status(200).json({
      success: true,
      count: contests.length,
      data: contests
    });
  } catch (error) {
    console.error('Get contests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contests',
      error: error.message
    });
  }
};

// @desc    Get single contest
// @route   GET /api/contests/:id
// @access  Public
export const getContest = async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);

    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found'
      });
    }

    // Build problems list dynamically when not present in contest doc
    let problemsList = [];
    if (Array.isArray(contest.problems) && contest.problems.length > 0) {
      const ids = contest.problems.map(p => p.problemId);
      const problems = await Problem.find({ _id: { $in: ids } });
      const map = new Map(problems.map(p => [p._id.toString(), p]));
      problemsList = contest.problems
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(p => ({ problemId: map.get(p.problemId.toString()), order: p.order || 0, points: p.points || (map.get(p.problemId.toString())?.points || 100) }));
    } else {
      const problems = await Problem.find({});
      problemsList = problems.map((p, idx) => ({ problemId: p, order: idx + 1, points: p.points || 100 }));
    }

    const response = contest.toObject ? contest.toObject() : contest;
    // Normalize any escaped code in templates/harness for each problem
    response.problems = problemsList.map((p) => {
      const problem = p.problemId && p.problemId.toObject ? p.problemId.toObject() : p.problemId;
      if (problem) {
        if (problem.codeTemplates && typeof problem.codeTemplates === 'object') {
          const normalized = {};
          for (const [lang, tpl] of Object.entries(problem.codeTemplates)) {
            if (typeof tpl === 'string') {
              normalized[lang] = tpl.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
            }
          }
          problem.codeTemplates = normalized;
        }
        const rawHarness = problem.harshnessCode || problem.harnessCode;
        if (typeof rawHarness === 'string') {
          problem.harshnessCode = rawHarness.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
        } else if (rawHarness && typeof rawHarness === 'object') {
          const normalizedH = {};
          for (const [lang, hs] of Object.entries(rawHarness)) {
            normalizedH[lang] = typeof hs === 'string' ? hs.replace(/\\n/g, '\n').replace(/\\t/g, '\t') : hs;
          }
          problem.harshnessCode = normalizedH;
        }
      }
      return { ...p, problemId: problem };
    });

    res.status(200).json({ success: true, data: response });
  } catch (error) {
    console.error('Get contest error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contest',
      error: error.message
    });
  }
};

// @desc    Create new contest
// @route   POST /api/contests
// @access  Private (Admin only)
export const createContest = async (req, res) => {
  try {
    const { title, description, problems, startTime, duration, rules } = req.body;

    let contest;

    contest = await Contest.create({
      title,
      description,
      problems,
      startTime: new Date(startTime),
      duration,
      rules,
      createdBy: req.user?.id
    });

    res.status(201).json({
      success: true,
      message: 'Contest created successfully',
      data: contest
    });
  } catch (error) {
    console.error('Create contest error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create contest',
      error: error.message
    });
  }
};

// @desc    Join contest
// @route   POST /api/contests/:id/join
// @access  Private
export const joinContest = async (req, res) => {
  try {
    const contestId = req.params.id;
    const userId = req.user.id;

    const contest = await Contest.findById(contestId);

    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found'
      });
    }

    // Check if contest has started
    if (new Date() < new Date(contest.startTime)) {
      return res.status(400).json({
        success: false,
        message: 'Contest has not started yet'
      });
    }

    // Check if contest has ended
    if (new Date() > new Date(contest.endTime)) {
      return res.status(400).json({
        success: false,
        message: 'Contest has already ended'
      });
    }

    const existingResult = await ContestResult.findOne({ 
      contestId, 
      userId 
    });

    if (existingResult) {
      return res.status(400).json({
        success: false,
        message: 'You have already joined this contest'
      });
    }

    const allProblems = Array.isArray(contest.problems) && contest.problems.length > 0
      ? contest.problems
      : (await Problem.find({})).map((p, idx) => ({ problemId: p._id, order: idx + 1, points: p.points || 100 }));

    const contestResult = await ContestResult.create({
      userId,
      contestId,
      problemResults: allProblems.map(p => ({
        problemId: p.problemId,
        maxScore: p.points,
        status: 'not_attempted'
      }))
    });

    res.status(200).json({
      success: true,
      message: 'Successfully joined contest',
      data: contestResult
    });
  } catch (error) {
    console.error('Join contest error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join contest',
      error: error.message
    });
  }
};

// @desc    Get contest leaderboard
// @route   GET /api/contests/:id/leaderboard
// @access  Public
export const getContestLeaderboard = async (req, res) => {
  try {
    const contestId = req.params.id;
    const leaderboard = await ContestResult.find({ contestId })
      .populate('userId', 'name email')
      .sort({ totalScore: -1, totalTime: 1 })
      .limit(100);

    // Add ranks
    const rankedLeaderboard = leaderboard.map((result, index) => ({
      ...result.toObject ? result.toObject() : result,
      rank: index + 1
    }));

    res.status(200).json({
      success: true,
      data: rankedLeaderboard
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard',
      error: error.message
    });
  }
};

// @desc    Get user's contest result
// @route   GET /api/contests/:id/my-result
// @access  Private
export const getMyContestResult = async (req, res) => {
  try {
    const contestId = req.params.id;
    const userId = req.user.id;

    const result = await ContestResult.findOne({ contestId, userId })
      .populate('problemResults.problemId', 'title difficulty tags');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'You have not joined this contest'
      });
    }

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get my result error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your result',
      error: error.message
    });
  }
};