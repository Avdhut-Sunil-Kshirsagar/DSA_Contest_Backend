import mongoose from 'mongoose';

const contestResultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contest',
    required: true
  },
  totalScore: {
    type: Number,
    default: 0
  },
  totalTime: {
    type: Number, // in milliseconds
    default: 0
  },
  problemResults: [{
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      required: true
    },
    score: {
      type: Number,
      default: 0
    },
    maxScore: {
      type: Number,
      required: true
    },
    timeSpent: {
      type: Number, // in milliseconds
      default: 0
    },
    submissionCount: {
      type: Number,
      default: 0
    },
    firstAcceptedAt: {
      type: Date
    },
    status: {
      type: String,
      enum: ['not_attempted', 'attempted', 'accepted', 'partial'],
      default: 'not_attempted'
    }
  }],
  rank: {
    type: Number
  },
  penalties: {
    type: Number,
    default: 0
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  isCompleted: {
    type: Boolean,
    default: false
  }
});

// Index for efficient queries
contestResultSchema.index({ contestId: 1, totalScore: -1, totalTime: 1 });
contestResultSchema.index({ userId: 1, contestId: 1 }, { unique: true });

// Calculate total score and time
contestResultSchema.methods.calculateTotals = function() {
  this.totalScore = this.problemResults.reduce((sum, result) => sum + result.score, 0);
  this.totalTime = this.problemResults.reduce((sum, result) => sum + result.timeSpent, 0);
  return this;
};

// Update problem result
contestResultSchema.methods.updateProblemResult = function(problemId, score, timeSpent, status, isFirstAccept = false) {
  const problemResult = this.problemResults.find(p => p.problemId.toString() === problemId.toString());
  
  if (problemResult) {
    problemResult.score = Math.max(problemResult.score, score);
    problemResult.timeSpent += timeSpent;
    problemResult.submissionCount += 1;
    problemResult.status = status;
    
    if (isFirstAccept && !problemResult.firstAcceptedAt) {
      problemResult.firstAcceptedAt = new Date();
    }
  } else {
    this.problemResults.push({
      problemId,
      score,
      maxScore: 100, // Default max score, should be set from problem
      timeSpent,
      submissionCount: 1,
      firstAcceptedAt: isFirstAccept ? new Date() : null,
      status
    });
  }
  
  this.calculateTotals();
  return this;
};

export default mongoose.model('ContestResult', contestResultSchema);
