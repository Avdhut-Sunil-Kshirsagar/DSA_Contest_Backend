import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema({
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
  problemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Problem',
    required: true
  },
  code: {
    type: String,
    required: true
  },
  language: {
    type: String,
    required: true,
    enum: ['python', 'javascript', 'cpp', 'java']
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'accepted', 'wrong_answer', 'time_limit_exceeded', 'runtime_error', 'compilation_error'],
    default: 'pending'
  },
  score: {
    type: Number,
    default: 0
  },
  maxScore: {
    type: Number,
    default: 0
  },
  testResults: [{
    testCaseId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    passed: {
      type: Boolean,
      default: false
    },
    executionTime: {
      type: Number, // in milliseconds
      default: 0
    },
    memoryUsed: {
      type: Number, // in MB
      default: 0
    },
    output: {
      type: String
    },
    error: {
      type: String
    }
  }],
  totalExecutionTime: {
    type: Number,
    default: 0
  },
  totalMemoryUsed: {
    type: Number,
    default: 0
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  evaluatedAt: {
    type: Date
  }
});

// Index for efficient queries
submissionSchema.index({ userId: 1, contestId: 1, problemId: 1 });
submissionSchema.index({ contestId: 1, status: 1 });
submissionSchema.index({ submittedAt: -1 });

// Calculate total execution time and memory
submissionSchema.methods.calculateTotals = function() {
  this.totalExecutionTime = this.testResults.reduce((sum, result) => sum + (result.executionTime || 0), 0);
  this.totalMemoryUsed = this.testResults.reduce((sum, result) => sum + (result.memoryUsed || 0), 0);
  return this;
};

// Calculate score based on test results
submissionSchema.methods.calculateScore = function() {
  const passedTests = this.testResults.filter(result => result.passed).length;
  const totalTests = this.testResults.length;
  this.score = totalTests > 0 ? Math.round((passedTests / totalTests) * this.maxScore) : 0;
  return this;
};

export default mongoose.model('Submission', submissionSchema);
