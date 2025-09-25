import mongoose from 'mongoose';

const contestSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Contest title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Contest description is required']
  },
  problems: [{
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      required: true
    },
    order: {
      type: Number,
      required: true
    },
    points: {
      type: Number,
      default: 100
    }
  }],
  startTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // in milliseconds
    required: true,
    default: 3600000 // 1 hour
  },
  endTime: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isLive: {
    type: Boolean,
    default: false
  },
  maxParticipants: {
    type: Number,
    default: 1000
  },
  currentParticipants: {
    type: Number,
    default: 0
  },
  rules: {
    type: String,
    default: 'Standard DSA competition rules apply. No external resources allowed during the contest.'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate end time before saving
contestSchema.pre('save', function(next) {
  this.endTime = new Date(this.startTime.getTime() + this.duration);
  this.updatedAt = new Date();
  next();
});

// Virtual for checking if contest is currently running
contestSchema.virtual('isRunning').get(function() {
  const now = new Date();
  return this.isLive && now >= this.startTime && now <= this.endTime;
});

// Virtual for checking if contest has ended
contestSchema.virtual('hasEnded').get(function() {
  const now = new Date();
  return now > this.endTime;
});

export default mongoose.model('Contest', contestSchema);
