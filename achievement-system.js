const fs = require('fs').promises;
const path = require('path');

class AchievementSystem {
  constructor() {
    this.achievements = {};
    this.userProgress = {};
    this.dataPath = path.join(__dirname, 'data', 'achievements.json');
    this.progressPath = path.join(__dirname, 'data', 'user_progress.json');
    this.initializeAchievements();
  }

  async initialize() {
    try {
      await this.loadAchievements();
      await this.loadUserProgress();
    } catch (error) {
      console.log('Initializing new achievement system...');
      await this.saveAchievements();
      await this.saveUserProgress();
    }
  }

  initializeAchievements() {
    this.achievements = {
      // Breeding Milestones
      'first_batch': {
        id: 'first_batch',
        name: 'First Steps',
        description: 'Create your first butterfly batch',
        icon: '🥚',
        category: 'breeding',
        requirement: 1,
        type: 'counter',
        field: 'batchesCreated',
        rarity: 'common',
        points: 10
      },
      'ten_batches': {
        id: 'ten_batches',
        name: 'Batch Master',
        description: 'Create 10 butterfly batches',
        icon: '🦋',
        category: 'breeding',
        requirement: 10,
        type: 'counter',
        field: 'batchesCreated',
        rarity: 'uncommon',
        points: 50
      },
      'fifty_batches': {
        id: 'fifty_batches',
        name: 'Breeding Expert',
        description: 'Create 50 butterfly batches',
        icon: '👑',
        category: 'breeding',
        requirement: 50,
        type: 'counter',
        field: 'batchesCreated',
        rarity: 'rare',
        points: 200
      },

      // Lifecycle Achievements
      'first_hatch': {
        id: 'first_hatch',
        name: 'Life Begins',
        description: 'Successfully hatch your first eggs',
        icon: '🐛',
        category: 'lifecycle',
        requirement: 1,
        type: 'counter',
        field: 'eggsHatched',
        rarity: 'common',
        points: 15
      },
      'first_harvest': {
        id: 'first_harvest',
        name: 'Full Circle',
        description: 'Complete your first full lifecycle',
        icon: '🏆',
        category: 'lifecycle',
        requirement: 1,
        type: 'counter',
        field: 'cyclesCompleted',
        rarity: 'uncommon',
        points: 100
      },
      'hundred_butterflies': {
        id: 'hundred_butterflies',
        name: 'Butterfly Garden',
        description: 'Harvest 100 butterflies',
        icon: '🌺',
        category: 'lifecycle',
        requirement: 100,
        type: 'counter',
        field: 'butterfliesHarvested',
        rarity: 'rare',
        points: 300
      },

      // Species Diversity
      'species_collector': {
        id: 'species_collector',
        name: 'Species Collector',
        description: 'Breed 3 different butterfly species',
        icon: '📚',
        category: 'diversity',
        requirement: 3,
        type: 'counter',
        field: 'speciesCount',
        rarity: 'uncommon',
        points: 75
      },
      'species_master': {
        id: 'species_master',
        name: 'Species Master',
        description: 'Breed all 8 butterfly species',
        icon: '🎭',
        category: 'diversity',
        requirement: 8,
        type: 'counter',
        field: 'speciesCount',
        rarity: 'legendary',
        points: 500
      },

      // Quality Achievements
      'quality_breeder': {
        id: 'quality_breeder',
        name: 'Quality Breeder',
        description: 'Achieve 90% quality score on a batch',
        icon: '⭐',
        category: 'quality',
        requirement: 0.9,
        type: 'threshold',
        field: 'maxQualityScore',
        rarity: 'uncommon',
        points: 60
      },
      'perfectionist': {
        id: 'perfectionist',
        name: 'Perfectionist',
        description: 'Achieve 100% quality score on a batch',
        icon: '💎',
        category: 'quality',
        requirement: 1.0,
        type: 'threshold',
        field: 'maxQualityScore',
        rarity: 'legendary',
        points: 1000
      },

      // Survival Rate
      'survival_expert': {
        id: 'survival_expert',
        name: 'Survival Expert',
        description: 'Achieve 95% survival rate on a batch',
        icon: '🛡️',
        category: 'survival',
        requirement: 0.95,
        type: 'threshold',
        field: 'maxSurvivalRate',
        rarity: 'rare',
        points: 150
      },

      // Feeding Consistency
      'dedicated_feeder': {
        id: 'dedicated_feeder',
        name: 'Dedicated Feeder',
        description: 'Feed batches 30 times',
        icon: '🥬',
        category: 'care',
        requirement: 30,
        type: 'counter',
        field: 'feedingCount',
        rarity: 'common',
        points: 40
      },
      'feeding_master': {
        id: 'feeding_master',
        name: 'Feeding Master',
        description: 'Feed batches 100 times',
        icon: '🌿',
        category: 'care',
        requirement: 100,
        type: 'counter',
        field: 'feedingCount',
        rarity: 'uncommon',
        points: 120
      },

      // Profit Achievements
      'first_profit': {
        id: 'first_profit',
        name: 'First Profit',
        description: 'Earn your first $100 in projected profits',
        icon: '💰',
        category: 'profit',
        requirement: 100,
        type: 'counter',
        field: 'totalProfit',
        rarity: 'common',
        points: 25
      },
      'profit_master': {
        id: 'profit_master',
        name: 'Profit Master',
        description: 'Earn $1000 in projected profits',
        icon: '💸',
        category: 'profit',
        requirement: 1000,
        type: 'counter',
        field: 'totalProfit',
        rarity: 'rare',
        points: 250
      },

      // Special Achievements
      'early_adopter': {
        id: 'early_adopter',
        name: 'Early Adopter',
        description: 'One of the first users of the system',
        icon: '🚀',
        category: 'special',
        requirement: 1,
        type: 'special',
        field: 'earlyAdopter',
        rarity: 'legendary',
        points: 500
      },
      'consistent_breeder': {
        id: 'consistent_breeder',
        name: 'Consistent Breeder',
        description: 'Maintain active batches for 7 consecutive days',
        icon: '📅',
        category: 'consistency',
        requirement: 7,
        type: 'streak',
        field: 'activeDays',
        rarity: 'rare',
        points: 180
      }
    };
  }

  async loadAchievements() {
    try {
      const data = await fs.readFile(this.dataPath, 'utf8');
      const saved = JSON.parse(data);
      // Merge saved achievements with current achievements to add new ones
      this.achievements = { ...this.achievements, ...saved };
    } catch (error) {
      // File doesn't exist, use default achievements
    }
  }

  async saveAchievements() {
    try {
      await fs.mkdir(path.dirname(this.dataPath), { recursive: true });
      await fs.writeFile(this.dataPath, JSON.stringify(this.achievements, null, 2));
    } catch (error) {
      console.error('Error saving achievements:', error);
    }
  }

  async loadUserProgress() {
    try {
      const data = await fs.readFile(this.progressPath, 'utf8');
      this.userProgress = JSON.parse(data);
    } catch (error) {
      this.userProgress = {};
    }
  }

  async saveUserProgress() {
    try {
      await fs.mkdir(path.dirname(this.progressPath), { recursive: true });
      await fs.writeFile(this.progressPath, JSON.stringify(this.userProgress, null, 2));
    } catch (error) {
      console.error('Error saving user progress:', error);
    }
  }

  // Initialize user progress if not exists
  initializeUserProgress(userId) {
    if (!this.userProgress[userId]) {
      this.userProgress[userId] = {
        userId: userId,
        achievements: [],
        stats: {
          batchesCreated: 0,
          eggsHatched: 0,
          cyclesCompleted: 0,
          butterfliesHarvested: 0,
          speciesCount: 0,
          uniqueSpecies: new Set(),
          maxQualityScore: 0,
          maxSurvivalRate: 0,
          feedingCount: 0,
          totalProfit: 0,
          activeDays: 0,
          lastActiveDate: null,
          earlyAdopter: false
        },
        totalPoints: 0,
        level: 1,
        nextLevelPoints: 100
      };
    }
  }

  // Update user statistics
  async updateUserStats(userId, statType, value, additionalData = {}) {
    this.initializeUserProgress(userId);
    const userStats = this.userProgress[userId].stats;
    
    switch (statType) {
      case 'batchCreated':
        userStats.batchesCreated++;
        if (additionalData.species) {
          userStats.uniqueSpecies.add(additionalData.species);
          userStats.speciesCount = userStats.uniqueSpecies.size;
        }
        break;
      
      case 'eggsHatched':
        userStats.eggsHatched += value;
        break;
      
      case 'cycleCompleted':
        userStats.cyclesCompleted++;
        if (additionalData.butterflies) {
          userStats.butterfliesHarvested += additionalData.butterflies;
        }
        break;
      
      case 'batchFed':
        userStats.feedingCount++;
        break;
      
      case 'qualityScore':
        userStats.maxQualityScore = Math.max(userStats.maxQualityScore, value);
        break;
      
      case 'survivalRate':
        userStats.maxSurvivalRate = Math.max(userStats.maxSurvivalRate, value);
        break;
      
      case 'profit':
        userStats.totalProfit += value;
        break;
      
      case 'dailyActivity':
        const today = new Date().toDateString();
        if (userStats.lastActiveDate !== today) {
          userStats.activeDays++;
          userStats.lastActiveDate = today;
        }
        break;
    }

    // Check for new achievements
    const newAchievements = this.checkAchievements(userId);
    await this.saveUserProgress();
    
    return newAchievements;
  }

  // Check if user has earned any new achievements
  checkAchievements(userId) {
    const userProgress = this.userProgress[userId];
    const newAchievements = [];
    
    for (const [achievementId, achievement] of Object.entries(this.achievements)) {
      // Skip if user already has this achievement
      if (userProgress.achievements.includes(achievementId)) {
        continue;
      }
      
      const userStats = userProgress.stats;
      let earned = false;
      
      switch (achievement.type) {
        case 'counter':
          earned = userStats[achievement.field] >= achievement.requirement;
          break;
        
        case 'threshold':
          earned = userStats[achievement.field] >= achievement.requirement;
          break;
        
        case 'special':
          earned = userStats[achievement.field] === true;
          break;
        
        case 'streak':
          earned = userStats[achievement.field] >= achievement.requirement;
          break;
      }
      
      if (earned) {
        userProgress.achievements.push(achievementId);
        userProgress.totalPoints += achievement.points;
        newAchievements.push(achievement);
        
        // Update user level
        this.updateUserLevel(userId);
      }
    }
    
    return newAchievements;
  }

  // Update user level based on points
  updateUserLevel(userId) {
    const userProgress = this.userProgress[userId];
    const points = userProgress.totalPoints;
    
    // Level calculation: every 100 points = 1 level, with scaling
    const newLevel = Math.floor(Math.sqrt(points / 10)) + 1;
    
    if (newLevel > userProgress.level) {
      userProgress.level = newLevel;
      userProgress.nextLevelPoints = Math.pow(newLevel, 2) * 10;
    }
  }

  // Get user achievements and progress
  getUserProgress(userId) {
    this.initializeUserProgress(userId);
    const userProgress = this.userProgress[userId];
    
    const earnedAchievements = userProgress.achievements.map(id => ({
      ...this.achievements[id],
      earnedDate: new Date()
    }));
    
    const availableAchievements = Object.values(this.achievements).filter(
      achievement => !userProgress.achievements.includes(achievement.id)
    );
    
    return {
      userId: userId,
      level: userProgress.level,
      totalPoints: userProgress.totalPoints,
      nextLevelPoints: userProgress.nextLevelPoints,
      earnedAchievements: earnedAchievements,
      availableAchievements: availableAchievements,
      stats: userProgress.stats,
      progress: this.getProgressToNextAchievements(userId)
    };
  }

  // Get progress towards next achievements
  getProgressToNextAchievements(userId) {
    const userProgress = this.userProgress[userId];
    const progressData = [];
    
    for (const achievement of Object.values(this.achievements)) {
      if (userProgress.achievements.includes(achievement.id)) {
        continue;
      }
      
      const userStats = userProgress.stats;
      let currentValue = 0;
      let percentage = 0;
      
      switch (achievement.type) {
        case 'counter':
        case 'threshold':
          currentValue = userStats[achievement.field] || 0;
          percentage = Math.min((currentValue / achievement.requirement) * 100, 100);
          break;
        
        case 'special':
          currentValue = userStats[achievement.field] ? 1 : 0;
          percentage = currentValue * 100;
          break;
        
        case 'streak':
          currentValue = userStats[achievement.field] || 0;
          percentage = Math.min((currentValue / achievement.requirement) * 100, 100);
          break;
      }
      
      if (percentage > 0) {
        progressData.push({
          achievement: achievement,
          currentValue: currentValue,
          requiredValue: achievement.requirement,
          percentage: percentage
        });
      }
    }
    
    return progressData.sort((a, b) => b.percentage - a.percentage);
  }

  // Get leaderboard
  getLeaderboard(limit = 10) {
    const leaderboard = Object.values(this.userProgress)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, limit)
      .map(user => ({
        userId: user.userId,
        level: user.level,
        totalPoints: user.totalPoints,
        achievementCount: user.achievements.length,
        stats: user.stats
      }));
    
    return leaderboard;
  }

  // Mark user as early adopter
  async markEarlyAdopter(userId) {
    this.initializeUserProgress(userId);
    this.userProgress[userId].stats.earlyAdopter = true;
    const newAchievements = this.checkAchievements(userId);
    await this.saveUserProgress();
    return newAchievements;
  }

  // Get achievement by ID
  getAchievement(achievementId) {
    return this.achievements[achievementId];
  }

  // Get all achievements by category
  getAchievementsByCategory(category) {
    return Object.values(this.achievements).filter(achievement => 
      achievement.category === category
    );
  }

  // Get rarity color for UI
  getRarityColor(rarity) {
    const colors = {
      common: '#9CA3AF',
      uncommon: '#10B981',
      rare: '#3B82F6',
      epic: '#8B5CF6',
      legendary: '#F59E0B'
    };
    return colors[rarity] || colors.common;
  }
}

module.exports = AchievementSystem;