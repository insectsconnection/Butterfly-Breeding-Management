const express = require('express');
const multer = require('multer');
const twilio = require('twilio');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const QRCode = require('qrcode');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs').promises;
const path = require('path');

// Import authentication and CNN modules
const auth = require('./auth');
const { cnnModelManager, SPECIES_MARKET_PRICES, SPECIES_HOST_PLANTS, butterfly_species_names_INFO } = require('./cnn-models');
const { paymentProcessor, PAYMENT_STATUS, PAYMENT_METHODS } = require('./payment-system');
const AchievementSystem = require('./achievement-system');

// Import database operations
const Database = require('./database.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize achievement system
const achievementSystem = new AchievementSystem();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Multer for file uploads
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Twilio configuration
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && 
    process.env.TWILIO_AUTH_TOKEN && 
    process.env.TWILIO_PHONE_NUMBER &&
    process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
  try {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (error) {
    console.error('Error initializing Twilio:', error.message);
    twilioClient = null;
  }
}

// Data storage (JSON files)
const DATA_DIR = './data';
const BATCHES_FILE = path.join(DATA_DIR, 'batches.json');
const BREEDING_LOG_FILE = path.join(DATA_DIR, 'breeding_log.json');
const PROFIT_DATA_FILE = path.join(DATA_DIR, 'profit_data.json');

// Use the comprehensive species database from CNN models
const HOST_PLANT_REQUIREMENTS = SPECIES_HOST_PLANTS;

// Extended task types for comprehensive breeding management
const TASK_TYPES = {
  FEEDING: 'feeding',
  PEST_CONTROL: 'pest_control',
  CAGE_CLEANING: 'cage_cleaning',
  HEALTH_CHECK: 'health_check',
  PLANT_REPLACEMENT: 'plant_replacement',
  TEMPERATURE_CHECK: 'temperature_check',
  HUMIDITY_CHECK: 'humidity_check',
  BREEDING_RECORD: 'breeding_record',
  QUALITY_ASSESSMENT: 'quality_assessment',
  HARVEST: 'harvest'
};

// Quality matrix for pupae valuation
const QUALITY_MATRIX = {
  "Healthy": 1.0,
  "Minor Defects": 0.8,
  "Antbites": 0.7,
  "Slight Deformation": 0.6,
  "Deformed Body": 0.4,
  "Severe Damage": 0.2
};

// Lifecycle stages
const lifestages_names = ["Butterfly","Egg", "Larva", "Pupa"];

// CageBatch class
class CageBatch {
  constructor(species, startDate, larvaCount, phoneNumber) {
    this.cageId = uuidv4();
    this.species = species;
    this.startDate = new Date(startDate);
    this.larvaCount = larvaCount;
    this.phoneNumber = phoneNumber;
    this.lifecycleStage = "Egg";
    this.hostPlant = HOST_PLANT_REQUIREMENTS[species]?.plant || "Unknown";
    this.dailyConsumption = HOST_PLANT_REQUIREMENTS[species]?.dailyConsumption || 150;
    this.marketPrice = HOST_PLANT_REQUIREMENTS[species]?.marketPrice || 25.00;
    this.survivalRate = 0.98;
    this.foliageLevel = 100;
    this.lastFeeding = new Date();
    this.nextFeeding = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    this.defects = [];
    this.qualityScore = 1.0;
    this.active = true;
    this.notes = "";
    this.images = [];
  }

  calculateProfitProjection() {
    const daysInLifecycle = 45; // Average butterfly lifecycle
    const hostPlantCost = 2.50; // per day
    const laborCost = 5.00; // per day
    
    const productionCost = (hostPlantCost + laborCost) * daysInLifecycle;
    const qualityAdjustedCount = this.larvaCount * this.survivalRate * this.qualityScore;
    const revenue = qualityAdjustedCount * this.marketPrice;
    
    return {
      revenue: revenue,
      productionCost: productionCost,
      profit: revenue - productionCost,
      qualityAdjustedCount: qualityAdjustedCount
    };
  }

  updateQualityScore() {
    if (this.defects.length === 0) {
      this.qualityScore = 1.0;
      return;
    }
    
    let totalScore = 0;
    this.defects.forEach(defect => {
      totalScore += QUALITY_MATRIX[defect.type] || 0.5;
    });
    
    this.qualityScore = totalScore / this.defects.length;
  }

  addDefect(type, severity, description) {
    this.defects.push({
      id: uuidv4(),
      type: type,
      severity: severity,
      description: description,
      timestamp: new Date()
    });
    this.updateQualityScore();
  }

  updateLifecycleStage(stage) {
    if (lifestages_names.includes(stage)) {
      this.lifecycleStage = stage;
      this.logActivity(`Lifecycle stage updated to ${stage}`);
    }
  }

  logActivity(activity) {
    const logEntry = {
      cageId: this.cageId,
      timestamp: new Date(),
      activity: activity,
      lifecycleStage: this.lifecycleStage
    };
    
    // This will be handled by the main logging system
    return logEntry;
  }
}

// Initialize data directory
async function initializeDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir('./uploads', { recursive: true });
    
    // Initialize data files if they don't exist
    const dataFiles = [BATCHES_FILE, BREEDING_LOG_FILE, PROFIT_DATA_FILE];
    for (const file of dataFiles) {
      try {
        await fs.access(file);
      } catch (error) {
        await fs.writeFile(file, JSON.stringify([], null, 2));
      }
    }
  } catch (error) {
    console.error('Error initializing data directory:', error);
  }
}

// Data management functions - Updated to use PostgreSQL
async function loadBatches() {
  try {
    const batches = await Database.getAllBatches();
    
    // Add marketplace sales history for each batch to preserve existing functionality
    const batchesWithSales = await Promise.all(batches.map(async (batch) => {
      try {
        // Load sales history from all marketplace tables
        const pupaeSales = await Database.getPupaeSalesHistory();
        const larvaSales = await Database.getLarvaSalesHistory();
        const eggSales = await Database.getEggSalesHistory();
        const butterflySales = await Database.getButterflySalesHistory();
        
        // Find sales for this specific batch
        const batchSales = [
          ...pupaeSales.filter(sale => sale.batch_id === batch.cage_id),
          ...larvaSales.filter(sale => sale.batch_id === batch.cage_id),
          ...eggSales.filter(sale => sale.batch_id === batch.cage_id),
          ...butterflySales.filter(sale => sale.batch_id === batch.cage_id)
        ];
        
        // Convert database format to frontend format
        batch.salesHistory = batchSales.map(sale => ({
          purchaserId: sale.seller_id,
          purchaserName: sale.seller_name,
          purchaserUsername: sale.seller_username,
          purchaserRole: sale.seller_role,
          salePrice: parseFloat(sale.final_sale_price),
          finalSalePrice: parseFloat(sale.final_sale_price),
          purchaseDate: sale.sold_at,
          paymentMethod: 'GCash',
          orderId: `ORDER-${sale.id}`,
          lifecycleStage: batch.lifecycle_stage
        }));
        
        // Convert database column names to frontend format
        batch.cageId = batch.cage_id;
        batch.larvaCount = batch.larval_count;
        batch.lifecycleStage = batch.lifecycle_stage;
        batch.qualityScore = parseFloat(batch.quality_score || 0.85);
        batch.foliageLevel = batch.foliage_level || 100;
        batch.lastFeeding = batch.last_feeding;
        batch.nextFeeding = batch.next_feeding;
        batch.startDate = batch.start_date;
        batch.phoneNumber = batch.phone_number;
        batch.hostPlant = batch.host_plant;
        batch.createdBy = batch.created_by;
        
        return batch;
      } catch (error) {
        console.error('Error processing batch sales history:', error);
        batch.salesHistory = [];
        return batch;
      }
    }));
    
    return batchesWithSales;
  } catch (error) {
    console.error('Error loading batches from database:', error);
    return [];
  }
}

async function saveBatches(batches) {
  try {
    // This function is now replaced by individual database operations
    // Keep for backward compatibility but log a warning
    // Parameter 'batches' is preserved for API compatibility but not used
    console.warn('saveBatches() called but should use individual database operations');
    console.warn(`Legacy call attempted to save ${batches?.length || 0} batches`);
    return true;
  } catch (error) {
    console.error('Error in saveBatches compatibility function:', error);
    return false;
  }
}

// New function to save individual batch to database
async function saveBatch(batchData) {
  try {
    const batch = await Batch.findByPk(batchData.cageId);
    if (batch) {
      // Update existing batch
      await batch.update(batchData);
      return batch.toJSON();
    } else {
      // Create new batch
      const newBatch = await Batch.create(batchData);
      return newBatch.toJSON();
    }
  } catch (error) {
    console.error('Error saving batch to database:', error);
    throw error;
  }
}

async function loadBreedingLog() {
  try {
    const logs = await Database.getBreedingLog();
    return logs;
  } catch (error) {
    console.error('Error loading breeding log from database:', error);
    return [];
  }
}

async function saveBreedingLog(log) {
  try {
    // This function is now replaced by individual database operations
    console.warn('saveBreedingLog() called but should use individual database operations');
    return true;
  } catch (error) {
    console.error('Error in saveBreedingLog compatibility function:', error);
    return false;
  }
}

async function logActivity(cageId, activity, lifecycleStage = null, userId = null) {
  try {
    const entry = await Database.addBreedingLog({
      cageId: cageId,
      activity: activity,
      lifecycleStage: lifecycleStage,
      userId: userId // Pass null if no valid user ID
    });
    
    // Emit to connected clients
    io.emit('activityLog', entry);
    
    return entry;
  } catch (error) {
    console.error('Error logging activity to database:', error);
    return null;
  }
}

// Handle automatic lifecycle transitions and actions
async function handleLifecycleTransition(batch, oldStage, newStage, cageId) {
  const now = new Date();
  
  switch (newStage) {
    case 'Larva':
      if (oldStage === 'Egg') {
        // Egg hatches → mark as hatched
        batch.hatchedDate = now;
        batch.status = 'hatched';
        await logActivity(cageId, '🥚➡️🐛 Eggs hatched successfully', newStage);
        
        // Reset feeding schedule for larvae
        batch.lastFeeding = now;
        batch.nextFeeding = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        
        // Update achievement progress for hatching
        if (batch.createdBy) {
          const newAchievements = await achievementSystem.updateUserStats(batch.createdBy, 'eggsHatched', batch.larvaCount);
          if (newAchievements.length > 0) {
            io.emit('achievementUnlocked', { userId: batch.createdBy, achievements: newAchievements });
          }
        }
      }
      break;
      
    case 'Pupa':
      if (oldStage === 'Larva') {
        // Transfer larvae to pupation → mark as transferred
        batch.transferredDate = now;
        batch.status = 'transferred';
        await logActivity(cageId, '🐛➡️🛡️ Larvae transferred to pupation stage', newStage);
        
        // Stop feeding schedule for pupae
        batch.nextFeeding = null;
      }
      break;
      
    case 'Butterfly':
      if (oldStage === 'Pupa') {
        // Harvest pupae → mark as harvested
        batch.harvestedDate = now;
        batch.status = 'harvested';
        batch.active = false; // Batch completed
        await logActivity(cageId, '🛡️➡️🦋 Pupae harvested as butterflies', newStage);
        
        // Resume feeding schedule for adult butterflies
        batch.lastFeeding = now;
        batch.nextFeeding = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        
        // Update achievement progress for completing lifecycle
        const newAchievements = await achievementSystem.updateUserStats(batch.createdBy || 'admin', 'cycleCompleted', 1, { butterflies: batch.larvaCount });
        if (newAchievements.length > 0) {
          io.emit('achievementUnlocked', { userId: batch.createdBy || 'admin', achievements: newAchievements });
        }
      }
      break;
  }
  
  // Update lifecycle progression tracking
  if (!batch.lifecycleHistory) {
    batch.lifecycleHistory = [];
  }
  
  batch.lifecycleHistory.push({
    stage: newStage,
    date: now,
    previousStage: oldStage,
    automaticAction: batch.status
  });
}

// Twilio SMS functions
async function sendSMSNotification(phoneNumber, message) {
  if (!twilioClient || !process.env.TWILIO_PHONE_NUMBER) {
    console.error('Twilio not configured');
    return false;
  }

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });
    
    console.log('SMS sent successfully:', result.sid);
    return true;
  } catch (error) {
    console.error('Error sending SMS:', error);
    return false;
  }
}

function formatFeedingReminderMessage(batch) {
  const profitData = new CageBatch().calculateProfitProjection.call(batch);
  
  return `🦋 Butterfly Breeding Alert!
  
Cage: ${batch.cageId.substring(0, 8)}
Species: ${batch.species}
Stage: ${batch.lifecycleStage}
Count: ${batch.larvaCount}
Foliage Level: ${batch.foliageLevel}%

Action Required: Feeding/Care needed
Profit at Risk: $${profitData.profit.toFixed(2)}

Check the system for details.`;
}

// QR Code generation
async function generateQRCode(data) {
  try {
    const qrCode = await QRCode.toDataURL(JSON.stringify(data));
    return qrCode;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return null;
  }
}

// Automated monitoring and notifications
async function checkFeedingSchedule() {
  const batches = await loadBatches();
  const now = new Date();
  
  for (const batch of batches) {
    if (!batch.active) continue;
    
    // Check if pupae are 3 days old and need to be listed for sale
    await checkPupaeForSale(batch, now);
    
    const timeUntilFeeding = new Date(batch.nextFeeding) - now;
    const hoursUntilFeeding = timeUntilFeeding / (1000 * 60 * 60);
    
    if (hoursUntilFeeding <= 1 && hoursUntilFeeding > 0) {
      // Send warning notification
      const message = formatFeedingReminderMessage(batch);
      await sendSMSNotification(batch.phoneNumber, message);
      await logActivity(batch.cageId, 'Feeding reminder sent', batch.lifecycleStage);
      
      // Emit to connected clients
      io.emit('feedingAlert', {
        cageId: batch.cageId,
        species: batch.species,
        timeUntilFeeding: hoursUntilFeeding
      });
    } else if (hoursUntilFeeding <= 0) {
      // Overdue notification
      const overdueHours = Math.abs(hoursUntilFeeding);
      const message = `⚠️ OVERDUE: ${formatFeedingReminderMessage(batch)}
      
Overdue by: ${overdueHours.toFixed(1)} hours`;
      
      await sendSMSNotification(batch.phoneNumber, message);
      await logActivity(batch.cageId, `Feeding overdue by ${overdueHours.toFixed(1)} hours`, batch.lifecycleStage);
      
      io.emit('overdueAlert', {
        cageId: batch.cageId,
        species: batch.species,
        overdueHours: overdueHours
      });
    }
  }
}

// Check if pupae are 3 days old and automatically list for sale
async function checkPupaeForSale(batch, now) {
  try {
    if (batch.lifecycleStage !== 'Pupa') return;
    
    // Check if pupae stage started 3 days ago
    const pupaeStageStart = batch.pupaeStageDate ? new Date(batch.pupaeStageDate) : null;
    if (!pupaeStageStart) return;
    
    const daysSincePupation = (now - pupaeStageStart) / (1000 * 60 * 60 * 24);
    
    // If pupae are 3 days old and not yet listed for sale
    if (daysSincePupation >= 3 && !batch.listedForSale) {
      await listPupaeForSale(batch);
      
      // Send notification to breeder
      const message = `🦋 AUTOMATIC LISTING ALERT!
      
Cage: ${batch.cageId.substring(0, 8)}
Species: ${batch.species}
Pupae Count: ${batch.larvaCount}
Status: Listed for sale (3 days old)

Your pupae have been automatically listed in the marketplace!`;
      
      await sendSMSNotification(batch.phoneNumber, message);
      await logActivity(batch.cageId, 'Pupae automatically listed for sale (3 days old)', batch.lifecycleStage);
      
      // Emit to connected clients
      io.emit('pupaeListedForSale', {
        cageId: batch.cageId,
        species: batch.species,
        count: batch.larvaCount,
        autoListed: true
      });
    }
  } catch (error) {
    console.error('Error checking pupae for sale:', error);
  }
}

// List pupae for sale in the marketplace
async function listPupaeForSale(batch) {
  try {
    const speciesInfo = require('./cnn-models').BUTTERFLY_SPECIES_INFO[batch.species];
    const marketPrice = SPECIES_MARKET_PRICES[batch.species] || 25.00;
    
    // Calculate quality-adjusted price
    const qualityScore = batch.qualityScore || 1.0;
    const adjustedPrice = marketPrice * qualityScore;
    
    // Create marketplace listing
    const listingData = {
      batchId: batch.cageId,
      species: batch.species,
      scientificName: speciesInfo?.scientific_name || 'Unknown',
      family: speciesInfo?.family || 'Unknown',
      lifecycleStage: 'Pupa',
      count: batch.larvaCount,
      price: adjustedPrice,
      qualityScore: qualityScore,
      description: `High-quality ${batch.species} pupae, 3 days old and ready for emergence. ${speciesInfo?.description || ''}`,
      sellerId: batch.userId,
      sellerPhone: batch.phoneNumber,
      listedDate: new Date().toISOString(),
      autoListed: true,
      hostPlants: SPECIES_HOST_PLANTS[batch.species]?.plant || [],
      expectedEmergence: calculateEmergenceDate(batch.pupaeStageDate),
      status: 'available'
    };
    
    // Add to pupae sales database
    await Database.addPupaeSale(listingData);
    
    // Update batch to mark as listed
    await Database.updateBatch(batch.cageId, {
      listedForSale: true,
      listedDate: new Date().toISOString(),
      marketPrice: adjustedPrice
    });
    
    console.log(`✅ Pupae automatically listed for sale: ${batch.species} (${batch.cageId})`);
  } catch (error) {
    console.error('Error listing pupae for sale:', error);
  }
}

// Calculate expected emergence date based on species
function calculateEmergenceDate(pupaeDate) {
  const pupaeStart = new Date(pupaeDate);
  // Most butterfly pupae emerge in 7-14 days, default to 10 days
  const emergenceDays = 10;
  const emergenceDate = new Date(pupaeStart.getTime() + (emergenceDays * 24 * 60 * 60 * 1000));
  return emergenceDate.toISOString();
}

// Schedule monitoring every 30 minutes
cron.schedule('*/30 * * * *', checkFeedingSchedule);

// Authentication Routes

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    const user = await auth.authenticateUser(username, password);
    const token = auth.generateToken(user);
    
    await logActivity('system', `User ${username} logged in`, null);
    
    res.json({
      user: user,
      token: token,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const userData = req.body;
    
    // Validate required fields
    if (!userData.username || !userData.email || !userData.password) {
      return res.status(400).json({ error: 'Username, email, and password required' });
    }
    
    const user = await auth.registerUser(userData);
    
    await logActivity('system', `New user registered: ${userData.username}`, null);
    
    res.status(201).json({
      user: user,
      message: 'Registration successful'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get current user profile
app.get('/api/auth/profile', auth.authenticateToken, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Get all users (admin only)
app.get('/api/auth/users', auth.authenticateToken, auth.requirePermission('*'), async (req, res) => {
  try {
    const users = await auth.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Update user (admin or own profile)
app.put('/api/auth/users/:userId', auth.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    
    // Users can only update their own profile unless they're admin
    if (userId !== req.user.id && !auth.hasPermission(req.user.role, '*')) {
      return res.status(403).json({ error: 'Can only update your own profile' });
    }
    
    const updatedUser = await auth.updateUser(userId, updates);
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CNN Classification Routes

// Get model status
app.get('/api/cnn/status', auth.authenticateToken, async (req, res) => {
  try {
    const status = cnnModelManager.getModelStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get model status' });
  }
});

// Classify image
app.post('/api/cnn/classify', auth.authenticateToken, auth.requirePermission('classify_images'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    const { analysisType = 'all' } = req.body;
    const imageBuffer = await fs.readFile(req.file.path);
    
    const results = await cnnModelManager.performFullAnalysis(imageBuffer, analysisType);
    
    // Log the classification activity
    await logActivity(req.user.id, `Image classified: ${analysisType}`, null);
    
    // Clean up uploaded file
    await fs.unlink(req.file.path);
    
    res.json({
      results: results,
      user: req.user.username,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Classification error:', error);
    
    // Clean up uploaded file if it exists
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Get species information
app.get('/api/species', auth.authenticateToken, async (req, res) => {
  try {
    const speciesData = Object.keys(SPECIES_HOST_PLANTS).map(species => ({
      name: species,
      hostPlant: SPECIES_HOST_PLANTS[species],
      marketPrice: SPECIES_MARKET_PRICES[species] || 25.00,
      scientificName: butterfly_species_names_INFO[species]?.scientific_name || 'Unknown',
      family: butterfly_species_names_INFO[species]?.family || 'Unknown',
      description: butterfly_species_names_INFO[species]?.description || '',
      discovered: butterfly_species_names_INFO[species]?.discovered || 'Unknown',
      year: butterfly_species_names_INFO[species]?.year || 'Unknown'
    }));
    
    res.json(speciesData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get species data' });
  }
});

// Task Management Routes

// Get all tasks for user
app.get('/api/tasks', auth.authenticateToken, async (req, res) => {
  try {
    // Load tasks from file or database
    const tasksFile = path.join(DATA_DIR, 'tasks.json');
    let tasks = [];
    
    try {
      const data = await fs.readFile(tasksFile, 'utf8');
      tasks = JSON.parse(data);
    } catch (error) {
      // File doesn't exist yet
      tasks = [];
    }
    
    // Filter tasks by user if not admin
    if (!auth.hasPermission(req.user.role, '*')) {
      tasks = tasks.filter(task => task.assignedTo === req.user.id);
    }
    
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load tasks' });
  }
});

// Create new task
app.post('/api/tasks', auth.authenticateToken, auth.requirePermission('manage_tasks'), async (req, res) => {
  try {
    const { title, description, type, priority, dueDate, assignedTo, cageId } = req.body;
    
    const newTask = {
      id: uuidv4(),
      title: title,
      description: description,
      type: type || TASK_TYPES.FEEDING,
      priority: priority || 'medium',
      status: 'pending',
      createdBy: req.user.id,
      assignedTo: assignedTo || req.user.id,
      cageId: cageId,
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      completedAt: null
    };
    
    // Load existing tasks
    const tasksFile = path.join(DATA_DIR, 'tasks.json');
    let tasks = [];
    
    try {
      const data = await fs.readFile(tasksFile, 'utf8');
      tasks = JSON.parse(data);
    } catch (error) {
      tasks = [];
    }
    
    tasks.push(newTask);
    
    // Save tasks
    await fs.writeFile(tasksFile, JSON.stringify(tasks, null, 2));
    
    await logActivity(req.user.id, `Task created: ${title}`, null);
    
    // Emit to connected clients
    io.emit('taskCreated', newTask);
    
    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task status
app.put('/api/tasks/:taskId', auth.authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;
    
    const tasksFile = path.join(DATA_DIR, 'tasks.json');
    let tasks = [];
    
    try {
      const data = await fs.readFile(tasksFile, 'utf8');
      tasks = JSON.parse(data);
    } catch (error) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const task = tasks[taskIndex];
    
    // Check permissions - users can only update their own tasks unless admin
    if (task.assignedTo !== req.user.id && !auth.hasPermission(req.user.role, '*')) {
      return res.status(403).json({ error: 'Can only update your own tasks' });
    }
    
    // Update task
    Object.keys(updates).forEach(key => {
      if (key !== 'id') {
        task[key] = updates[key];
      }
    });
    
    if (updates.status === 'completed') {
      task.completedAt = new Date();
    }
    
    tasks[taskIndex] = task;
    await fs.writeFile(tasksFile, JSON.stringify(tasks, null, 2));
    
    await logActivity(req.user.id, `Task updated: ${task.title}`, null);
    
    io.emit('taskUpdated', task);
    
    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Batch Management Routes (Updated with Authentication)

// Get all batches
app.get('/api/batches', auth.authenticateToken, auth.requirePermission('view_batches'), async (req, res) => {
  try {
    const batches = await loadBatches();
    
    // Calculate profit projections for each batch
    const batchesWithProfits = batches.map(batch => {
      const cageBatch = new CageBatch();
      Object.assign(cageBatch, batch);
      const profitData = cageBatch.calculateProfitProjection();
      
      return {
        ...batch,
        profitProjection: profitData
      };
    });
    
    res.json(batchesWithProfits);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load batches' });
  }
});

// Create marketplace listing
app.post('/api/marketplace/list', auth.authenticateToken, async (req, res) => {
  try {
    const { species, count, price, description, lifecycleStage = 'pupa' } = req.body;
    
    if (!species || !count || !price) {
      return res.status(400).json({ error: 'Missing required fields: species, count, and price' });
    }
    
    // Create a marketplace listing without phone number dependency
    const listing = {
      cageId: uuidv4(),
      species,
      count: parseInt(count),
      price: parseFloat(price),
      description: description || '',
      lifecycleStage,
      sellerId: req.user.id,
      sellerName: `${req.user.firstName} ${req.user.lastName}`,
      sellerUsername: req.user.username,
      sellerRole: req.user.role,
      createdAt: new Date(),
      status: 'available',
      forSale: true,
      listingType: 'marketplace'
    };

    // Save to database as a batch for marketplace
    const savedListing = await Database.createBatch({
      cageId: listing.cageId,
      species: listing.species,
      larvalCount: listing.count,
      lifecycleStage: listing.lifecycleStage,
      hostPlant: SPECIES_HOST_PLANTS[listing.species]?.plant || 'Unknown',
      startDate: listing.createdAt,
      phoneNumber: 'N/A', // No longer required
      notes: listing.description,
      createdBy: req.user.id,
      forSale: true,
      salePrice: listing.price
    });

    await logActivity(listing.cageId, 'Pupae listed for sale', listing.lifecycleStage, req.user.id);
    
    // Emit to connected clients
    io.emit('marketplaceListing', savedListing);
    
    res.status(201).json({ success: true, listing: savedListing });
  } catch (error) {
    console.error('Error creating marketplace listing:', error);
    res.status(500).json({ error: 'Failed to create marketplace listing' });
  }
});

// Purchase from marketplace
app.post('/api/marketplace/purchase', auth.authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.body;
    
    const batch = await Database.getBatchByCageId(itemId);
    if (!batch) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    if (!batch.for_sale) {
      return res.status(400).json({ error: 'Item is not available for purchase' });
    }
    
    // Create order
    const orderData = {
      buyerId: req.user.id,
      sellerId: batch.created_by,
      batchId: batch.cage_id,
      lifecycleStage: 'Pupa',
      species: batch.species,
      quantity: batch.larval_count,
      pricePerUnit: batch.sale_price,
      totalAmount: batch.sale_price * batch.larval_count
    };
    
    const order = await Database.createOrder(orderData);
    
    // Mark batch as sold
    await Database.updateBatch(itemId, { 
      for_sale: false, 
      status: 'sold',
      sold_at: new Date()
    });
    
    await logActivity(itemId, `Pupae purchased by ${req.user.username} for $${orderData.totalAmount}`, 'Pupa', req.user.id);
    
    // Emit to connected clients
    io.emit('pupaePurchased', { orderId: order.order_id, buyerId: req.user.id, sellerId: batch.created_by });
    
    res.json({ success: true, order, message: 'Purchase completed successfully!' });
  } catch (error) {
    console.error('Error purchasing item:', error);
    res.status(500).json({ error: 'Failed to complete purchase' });
  }
});

// Reserve from marketplace
app.post('/api/marketplace/reserve', auth.authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.body;
    
    const batch = await Database.getBatchByCageId(itemId);
    if (!batch) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    if (!batch.for_sale) {
      return res.status(400).json({ error: 'Item is not available for reservation' });
    }
    
    // Create reservation (24 hour hold)
    const reservationExpiry = new Date();
    reservationExpiry.setHours(reservationExpiry.getHours() + 24);
    
    await Database.updateBatch(itemId, { 
      reserved_by: req.user.id,
      reserved_until: reservationExpiry,
      status: 'reserved'
    });
    
    await logActivity(itemId, `Pupae reserved by ${req.user.username} until ${reservationExpiry.toLocaleString()}`, 'Pupa', req.user.id);
    
    // Emit to connected clients
    io.emit('pupaeReserved', { itemId, reservedBy: req.user.id, expiresAt: reservationExpiry });
    
    res.json({ 
      success: true, 
      message: 'Item reserved successfully for 24 hours!',
      expiresAt: reservationExpiry
    });
  } catch (error) {
    console.error('Error reserving item:', error);
    res.status(500).json({ error: 'Failed to reserve item' });
  }
});

// Legacy batch creation (keeping for compatibility)  
app.post('/api/batches', auth.authenticateToken, auth.requirePermission('create_batches'), async (req, res) => {
  try {
    const { species, larvaCount, phoneNumber, notes } = req.body;
    
    if (!species || !larvaCount) {
      return res.status(400).json({ error: 'Missing required fields: species and count' });
    }
    
    const batch = new CageBatch(species, new Date(), larvaCount, phoneNumber || 'N/A');
    batch.notes = notes || '';
    batch.createdBy = req.user.id; // Track the user who created this batch
    
    // Ensure user ID is valid UUID
    if (!req.user.id || typeof req.user.id !== 'string') {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    // Generate QR code for the batch
    const qrData = {
      cageId: batch.cageId,
      species: batch.species,
      created: batch.startDate
    };
    batch.qrCode = await generateQRCode(qrData);
    
    // Save to database
    const savedBatch = await Database.createBatch({
      cageId: batch.cageId,
      species: batch.species,
      larvalCount: batch.larvaCount,
      lifecycleStage: batch.lifecycleStage,
      hostPlant: batch.hostPlant,
      startDate: batch.startDate,
      phoneNumber: batch.phoneNumber,
      notes: batch.notes,
      createdBy: req.user.id
    });
    
    await logActivity(batch.cageId, 'Batch created', batch.lifecycleStage, req.user.id);
    
    // Update achievement progress
    const newAchievements = await achievementSystem.updateUserStats(req.user.id, 'batchCreated', 1, { species: species });
    if (newAchievements.length > 0) {
      io.emit('achievementUnlocked', { userId: req.user.id, achievements: newAchievements });
    }
    
    // Emit to connected clients
    io.emit('batchCreated', savedBatch);
    
    res.status(201).json(savedBatch);
  } catch (error) {
    console.error('Error creating batch:', error);
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

// Update batch
app.put('/api/batches/:cageId', async (req, res) => {
  try {
    const { cageId } = req.params;
    const updates = req.body;
    
    const batches = await loadBatches();
    const batchIndex = batches.findIndex(b => b.cageId === cageId);
    
    if (batchIndex === -1) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    const batch = batches[batchIndex];
    
    // Update fields
    Object.keys(updates).forEach(key => {
      if (key !== 'cageId') { // Prevent cageId changes
        batch[key] = updates[key];
      }
    });
    
    // Handle lifecycle stage updates with automatic actions
    if (updates.lifecycleStage && updates.lifecycleStage !== batch.lifecycleStage) {
      const oldStage = batch.lifecycleStage;
      const newStage = updates.lifecycleStage;
      
      // Automatic lifecycle actions
      await handleLifecycleTransition(batch, oldStage, newStage, cageId);
      
      await logActivity(cageId, `Lifecycle stage updated from ${oldStage} to ${newStage}`, newStage);
    }
    
    batches[batchIndex] = batch;
    await saveBatches(batches);
    
    // Emit to connected clients
    io.emit('batchUpdated', batch);
    
    res.json(batch);
  } catch (error) {
    console.error('Error updating batch:', error);
    res.status(500).json({ error: 'Failed to update batch' });
  }
});

// Mark batch as fed
app.post('/api/batches/:cageId/fed', async (req, res) => {
  try {
    const { cageId } = req.params;
    const batches = await loadBatches();
    const batch = batches.find(b => b.cageId === cageId);
    
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    batch.lastFeeding = new Date();
    batch.nextFeeding = new Date(Date.now() + 24 * 60 * 60 * 1000); // Next day
    batch.foliageLevel = 100; // Reset foliage level
    
    // Mark feeding based on lifecycle stage
    let feedingMessage = 'Batch fed';
    switch (batch.lifecycleStage) {
      case 'Larva':
        batch.status = 'fed';
        feedingMessage = '🐛 Larvae marked as fed';
        break;
      case 'Butterfly':
        batch.status = 'fed';
        feedingMessage = '🦋 Butterflies marked as fed';
        break;
      default:
        feedingMessage = `${batch.lifecycleStage} stage marked as fed`;
    }
    
    await saveBatches(batches);
    await logActivity(cageId, feedingMessage, batch.lifecycleStage);
    
    // Update achievement progress for feeding
    const newAchievements = await achievementSystem.updateUserStats(batch.createdBy || 'admin', 'batchFed', 1);
    if (newAchievements.length > 0) {
      io.emit('achievementUnlocked', { userId: batch.createdBy || 'admin', achievements: newAchievements });
    }
    
    // Emit to connected clients
    io.emit('batchFed', batch);
    
    res.json({ message: 'Batch marked as fed', batch });
  } catch (error) {
    console.error('Error marking batch as fed:', error);
    res.status(500).json({ error: 'Failed to mark batch as fed' });
  }
});

// Stage-specific actions for improved cage management
app.post('/api/batches/:cageId/stage-action', auth.authenticateToken, auth.requirePermission('update_batches'), async (req, res) => {
  try {
    const { cageId } = req.params;
    const { action } = req.body;
    const batches = await loadBatches();
    
    const batchIndex = batches.findIndex(b => b.cageId === cageId);
    if (batchIndex === -1) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    const batch = batches[batchIndex];
    let message = '';
    
    switch(action) {
      case 'MARK_AS_HATCHED':
        if (batch.lifecycleStage === 'Egg') {
          batch.status = 'hatched';
          batch.lastFeeding = new Date();
          batch.nextFeeding = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours for fresh larvae
          message = 'Eggs marked as hatched - feeding schedule started';
          await logActivity(cageId, 'Eggs hatched - feeding schedule activated', 'Egg');
        } else {
          return res.status(400).json({ error: 'Can only mark eggs as hatched' });
        }
        break;
        
      case 'MARK_AS_FED':
        if (batch.lifecycleStage === 'Larva') {
          batch.status = 'fed';
          batch.lastFeeding = new Date();
          batch.nextFeeding = new Date(Date.now() + 24 * 60 * 60 * 1000);
          batch.foliageLevel = Math.max(20, batch.foliageLevel - 15);
          message = 'Larvae marked as fed - next feeding scheduled';
          await logActivity(cageId, 'Larvae feeding completed', 'Larva');
        } else {
          return res.status(400).json({ error: 'Can only feed larvae stage' });
        }
        break;
        
      case 'MARK_AS_HARVESTED':
        if (batch.lifecycleStage === 'Pupa') {
          batch.status = 'harvested';
          batch.qualityScore = Math.min(1.0, batch.qualityScore + 0.05); // Quality improvement
          message = 'Pupae marked as harvested - quality assessed';
          await logActivity(cageId, 'Pupae harvested and quality assessed', 'Pupa');
        } else {
          return res.status(400).json({ error: 'Can only harvest pupae stage' });
        }
        break;
        
      case 'MARK_AS_FORAGE':
        if (batch.lifecycleStage === 'Butterfly') {
          batch.status = 'forage';
          batch.lastFeeding = new Date();
          batch.nextFeeding = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours for nectar
          message = 'Butterflies marked as foraging - nectar feeding scheduled';
          await logActivity(cageId, 'Butterfly foraging activity recorded', 'Butterfly');
        } else {
          return res.status(400).json({ error: 'Can only mark butterflies as foraging' });
        }
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid action specified' });
    }
    
    // Update achievement tracking
    if (req.user && req.user.id) {
      await achievementSystem.updateUserStats(req.user.id, 'stage_actions', 1, {
        action: action,
        cageId: cageId,
        stage: batch.lifecycleStage
      });
    }
    
    await saveBatches(batches);
    io.emit('batchUpdated', batch);
    
    res.json({ message, batch });
  } catch (error) {
    console.error('Error performing stage action:', error);
    res.status(500).json({ error: 'Failed to perform stage action' });
  }
});

// Lifecycle stage transition
app.post('/api/batches/:cageId/transition', auth.authenticateToken, auth.requirePermission('update_batches'), async (req, res) => {
  try {
    const { cageId } = req.params;
    const { newStage } = req.body;
    const batches = await loadBatches();
    
    const batchIndex = batches.findIndex(b => b.cageId === cageId);
    if (batchIndex === -1) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    const batch = batches[batchIndex];
    const previousStage = batch.lifecycleStage;
    
    // Validate transition
    const validTransitions = {
      'Egg': 'Larva',
      'Larva': 'Pupa',
      'Pupa': 'Butterfly'
    };
    
    if (validTransitions[previousStage] !== newStage) {
      return res.status(400).json({ 
        error: `Invalid transition from ${previousStage} to ${newStage}` 
      });
    }
    
    // Record lifecycle history
    if (!batch.lifecycleHistory) {
      batch.lifecycleHistory = [];
    }
    
    let automaticAction = '';
    
    // Apply stage-specific automatic actions
    switch(newStage) {
      case 'Larva':
        automaticAction = 'Started feeding schedule';
        batch.lastFeeding = new Date();
        batch.nextFeeding = new Date(Date.now() + 8 * 60 * 60 * 1000);
        break;
      case 'Pupa':
        automaticAction = 'Stopped feeding schedule - Will auto-list for sale in 3 days';
        batch.nextFeeding = null;
        batch.pupaeStageDate = new Date().toISOString(); // Track when pupae stage started
        batch.listedForSale = false; // Reset listing status
        break;
      case 'Butterfly':
        automaticAction = 'Started nectar feeding schedule';
        batch.lastFeeding = new Date();
        batch.nextFeeding = new Date(Date.now() + 12 * 60 * 60 * 1000);
        break;
    }
    
    batch.lifecycleHistory.push({
      previousStage,
      stage: newStage,
      date: new Date(),
      automaticAction
    });
    
    batch.lifecycleStage = newStage;
    
    // Update achievement tracking
    if (req.user && req.user.id) {
      await achievementSystem.updateUserStats(req.user.id, 'stage_transitions', 1, {
        from: previousStage,
        to: newStage,
        cageId: cageId
      });
    }
    
    await saveBatches(batches);
    await logActivity(cageId, `Lifecycle transitioned from ${previousStage} to ${newStage} - ${automaticAction}`, newStage);
    
    io.emit('batchUpdated', batch);
    
    res.json({ 
      message: automaticAction,
      batch,
      transition: { from: previousStage, to: newStage }
    });
  } catch (error) {
    console.error('Error transitioning lifecycle stage:', error);
    res.status(500).json({ error: 'Failed to transition lifecycle stage' });
  }
});

// Add defect to batch
app.post('/api/batches/:cageId/defects', async (req, res) => {
  try {
    const { cageId } = req.params;
    const { type, severity, description } = req.body;
    
    const batches = await loadBatches();
    const batch = batches.find(b => b.cageId === cageId);
    
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    const cageBatch = new CageBatch();
    Object.assign(cageBatch, batch);
    cageBatch.addDefect(type, severity, description);
    
    // Update the batch in storage
    Object.assign(batch, cageBatch);
    await saveBatches(batches);
    
    await logActivity(cageId, `Defect added: ${type} (${severity})`, batch.lifecycleStage);
    
    res.json({ message: 'Defect added', batch });
  } catch (error) {
    console.error('Error adding defect:', error);
    res.status(500).json({ error: 'Failed to add defect' });
  }
});

// Image upload for batch
app.post('/api/batches/:cageId/images', upload.single('image'), async (req, res) => {
  try {
    const { cageId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    
    const batches = await loadBatches();
    const batch = batches.find(b => b.cageId === cageId);
    
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    const imageData = {
      id: uuidv4(),
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      uploadDate: new Date(),
      size: req.file.size
    };
    
    if (!batch.images) {
      batch.images = [];
    }
    batch.images.push(imageData);
    
    await saveBatches(batches);
    await logActivity(cageId, `Image uploaded: ${req.file.originalname}`, batch.lifecycleStage);
    
    res.json({ message: 'Image uploaded successfully', image: imageData });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Get breeding log
app.get('/api/breeding-log', async (req, res) => {
  try {
    const log = await loadBreedingLog();
    res.json(log);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load breeding log' });
  }
});

// Get profit analytics
app.get('/api/analytics/profit', async (req, res) => {
  try {
    const batches = await loadBatches();
    
    let totalRevenue = 0;
    let totalCosts = 0;
    let totalProfit = 0;
    let activeBatches = 0;
    const speciesBreakdown = {};
    
    batches.forEach(batch => {
      if (batch.active) {
        activeBatches++;
        const cageBatch = new CageBatch();
        Object.assign(cageBatch, batch);
        const profitData = cageBatch.calculateProfitProjection();
        
        totalRevenue += profitData.revenue;
        totalCosts += profitData.productionCost;
        totalProfit += profitData.profit;
        
        if (!speciesBreakdown[batch.species]) {
          speciesBreakdown[batch.species] = {
            count: 0,
            revenue: 0,
            profit: 0,
            averageQuality: 0
          };
        }
        
        speciesBreakdown[batch.species].count++;
        speciesBreakdown[batch.species].revenue += profitData.revenue;
        speciesBreakdown[batch.species].profit += profitData.profit;
        speciesBreakdown[batch.species].averageQuality += batch.qualityScore;
      }
    });
    
    // Calculate averages
    Object.keys(speciesBreakdown).forEach(species => {
      speciesBreakdown[species].averageQuality /= speciesBreakdown[species].count;
    });
    
    res.json({
      summary: {
        totalRevenue,
        totalCosts,
        totalProfit,
        activeBatches,
        averageMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
      },
      speciesBreakdown
    });
  } catch (error) {
    console.error('Error calculating profit analytics:', error);
    res.status(500).json({ error: 'Failed to calculate analytics' });
  }
});

// Test SMS endpoint
app.post('/api/test-sms', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ error: 'Phone number and message required' });
    }
    
    const success = await sendSMSNotification(phoneNumber, message);
    
    if (success) {
      res.json({ message: 'SMS sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send SMS' });
    }
  } catch (error) {
    console.error('Error sending test SMS:', error);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

// Payment and Marketplace Routes

// Get marketplace listings (available batches for purchase)
app.get('/api/marketplace', auth.authenticateToken, async (req, res) => {
  try {
    const batches = await loadBatches();
    const users = await auth.getAllUsers();
    
    // Filter for batches available for sale
    const marketplaceItems = batches
      .filter(batch => batch.active && batch.forSale)
      .map(batch => {
        const cageBatch = new CageBatch();
        Object.assign(cageBatch, batch);
        const profitData = cageBatch.calculateProfitProjection();
        
        // Get seller details
        const seller = users.find(u => u.id === batch.createdBy);
        
        return {
          batchId: batch.cageId,
          species: batch.species,
          lifecycleStage: batch.lifecycleStage,
          larvaCount: batch.larvaCount,
          qualityScore: batch.qualityScore,
          price: profitData.revenue,
          pricePerItem: profitData.revenue / batch.larvaCount,
          hostPlant: batch.hostPlant,
          sellerInfo: {
            sellerId: batch.createdBy || 'unknown',
            sellerName: seller ? `${seller.firstName} ${seller.lastName}` : 'Unknown Seller',
            sellerUsername: seller ? seller.username : 'unknown',
            sellerRole: seller ? seller.role : 'unknown',
            location: batch.sellerLocation || 'Not specified',
            rating: batch.sellerRating || 5.0,
            totalSales: batch.sellerTotalSales || 0
          },
          images: batch.images || [],
          description: batch.notes,
          availableDate: batch.availableDate || new Date().toISOString(),
          createdAt: batch.startDate,
          listedAt: batch.listedForSaleAt || new Date().toISOString(),
          salesHistory: batch.salesHistory || []
        };
      });
    
    res.json(marketplaceItems);
  } catch (error) {
    console.error('Error loading marketplace:', error);
    res.status(500).json({ error: 'Failed to load marketplace' });
  }
});

// Create new order
app.post('/api/orders', auth.authenticateToken, auth.requirePermission('view_batches'), async (req, res) => {
  try {
    const { items, shippingAddress, notes } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }
    
    // Calculate total amount
    let totalAmount = 0;
    const orderItems = [];
    
    for (const item of items) {
      const batch = await loadBatches().then(batches => 
        batches.find(b => b.cageId === item.batchId)
      );
      
      if (!batch || !batch.forSale) {
        return res.status(400).json({ error: `Batch ${item.batchId} not available for sale` });
      }
      
      const itemTotal = item.price * item.quantity;
      totalAmount += itemTotal;
      
      orderItems.push({
        batchId: item.batchId,
        species: batch.species,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: itemTotal,
        sellerId: batch.createdBy
      });
    }
    
    // Get seller information (assuming single seller for now)
    const sellerId = orderItems[0].sellerId;
    const seller = await auth.getAllUsers().then(users => 
      users.find(u => u.id === sellerId)
    );
    
    const orderData = {
      buyerId: req.user.id,
      buyerEmail: req.user.email,
      buyerPhone: req.user.phone || '',
      sellerId: sellerId,
      sellerEmail: seller?.email || '',
      sellerPhone: seller?.phone || '',
      items: orderItems,
      totalAmount: totalAmount,
      shippingAddress: shippingAddress,
      notes: notes
    };
    
    const order = await paymentProcessor.createOrder(orderData);
    
    await logActivity(req.user.id, `Order created: ${order.orderId}`, null);
    
    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: error.message || 'Failed to create order' });
  }
});

// Create GCash payment
app.post('/api/payments/gcash', auth.authenticateToken, async (req, res) => {
  try {
    const { orderId, customerName, customerEmail, customerPhone } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }
    
    // Get order details
    const orders = await paymentProcessor.loadOrders();
    const order = orders.find(o => o.orderId === orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    if (order.buyerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const paymentData = {
      orderId: order.orderId,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      amount: order.totalAmount,
      description: `Butterfly Purchase - Order ${order.orderId}`,
      customerName: customerName || `${req.user.firstName} ${req.user.lastName}`,
      customerEmail: customerEmail || req.user.email,
      customerPhone: customerPhone || req.user.phone || ''
    };
    
    const payment = await paymentProcessor.createGCashPayment(paymentData);
    
    await logActivity(req.user.id, `GCash payment initiated: ${payment.paymentId}`, null);
    
    res.json(payment);
  } catch (error) {
    console.error('Error creating GCash payment:', error);
    res.status(500).json({ error: error.message || 'Failed to create payment' });
  }
});

// GCash payment callback (webhook)
app.post('/api/payments/gcash/callback', async (req, res) => {
  try {
    const callbackData = req.body;
    
    const result = await paymentProcessor.handleGCashCallback(callbackData);
    
    if (result.success) {
      // Emit payment update to connected clients
      io.emit('paymentUpdated', {
        paymentId: result.paymentId,
        status: result.status
      });
      
      res.json({ success: true, message: 'Callback processed successfully' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error processing GCash callback:', error);
    res.status(500).json({ success: false, error: 'Failed to process callback' });
  }
});

// Get payment status
app.get('/api/payments/:paymentId', auth.authenticateToken, async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const paymentStatus = await paymentProcessor.getPaymentStatus(paymentId);
    
    res.json(paymentStatus);
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({ error: error.message || 'Failed to get payment status' });
  }
});

// Get user orders
app.get('/api/orders', auth.authenticateToken, async (req, res) => {
  try {
    const { role = 'buyer' } = req.query;
    
    const orders = await paymentProcessor.getUserOrders(req.user.id, role);
    
    res.json(orders);
  } catch (error) {
    console.error('Error getting user orders:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// Cancel payment
app.post('/api/payments/:paymentId/cancel', auth.authenticateToken, async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const result = await paymentProcessor.cancelPayment(paymentId, req.user.id);
    
    await logActivity(req.user.id, `Payment cancelled: ${paymentId}`, null);
    
    res.json(result);
  } catch (error) {
    console.error('Error cancelling payment:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel payment' });
  }
});

// Get payment analytics
app.get('/api/analytics/payments', auth.authenticateToken, async (req, res) => {
  try {
    const { role } = req.query;
    
    let analytics;
    if (auth.hasPermission(req.user.role, '*')) {
      // Admin can see all analytics
      analytics = await paymentProcessor.getPaymentAnalytics();
    } else {
      // Users see their own analytics
      analytics = await paymentProcessor.getPaymentAnalytics(req.user.id, role);
    }
    
    res.json(analytics);
  } catch (error) {
    console.error('Error getting payment analytics:', error);
    res.status(500).json({ error: 'Failed to get payment analytics' });
  }
});

// Mark batch as for sale
app.post('/api/batches/:cageId/list-for-sale', auth.authenticateToken, auth.requirePermission('update_batches'), async (req, res) => {
  try {
    const { cageId } = req.params;
    const { price, description, availableDate, sellerLocation } = req.body;
    
    const batches = await loadBatches();
    const batchIndex = batches.findIndex(b => b.cageId === cageId);
    
    if (batchIndex === -1) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    const batch = batches[batchIndex];
    
    // Update batch for marketplace
    batch.forSale = true;
    batch.salePrice = price;
    batch.saleDescription = description;
    batch.availableDate = availableDate || new Date().toISOString();
    batch.listedForSaleAt = new Date().toISOString();
    batch.sellerLocation = sellerLocation;
    batch.sellerRating = 5.0; // Default rating
    batch.sellerTotalSales = batch.sellerTotalSales || 0;
    batch.salesHistory = batch.salesHistory || [];
    
    batches[batchIndex] = batch;
    await saveBatches(batches);
    
    await logActivity(req.user.id, `Batch listed for sale: ${cageId}`, batch.lifecycleStage);
    
    // Emit to connected clients
    io.emit('batchListedForSale', batch);
    
    res.json({ message: 'Batch listed for sale successfully', batch });
  } catch (error) {
    console.error('Error listing batch for sale:', error);
    res.status(500).json({ error: 'Failed to list batch for sale' });
  }
});

// Get pupae sales history with seller/purchaser details
app.get('/api/marketplace/pupae-sales', auth.authenticateToken, async (req, res) => {
  try {
    const pupaeSales = await Database.getPupaeSalesHistory();
    res.json(pupaeSales);
  } catch (error) {
    console.error('Error getting pupae sales:', error);
    res.status(500).json({ error: 'Failed to get pupae sales' });
  }
});

// Mark batch as harvested (for pupae)
app.put('/api/batches/:cageId/harvest', auth.authenticateToken, async (req, res) => {
  try {
    const { cageId } = req.params;
    const batch = await Database.getBatchByCageId(cageId);
    
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    // Update batch status to harvested
    const updatedBatch = await Database.updateBatch(cageId, {
      lifecycle_stage: 'Pupa',
      status: 'harvested'
    });
    
    await logActivity(cageId, 'Batch marked as harvested - pupae ready for sale', 'Pupa', req.user.id);
    
    // Update achievement progress
    const newAchievements = await achievementSystem.updateUserStats(req.user.id, 'batchHarvested', 1);
    if (newAchievements.length > 0) {
      io.emit('achievementUnlocked', { userId: req.user.id, achievements: newAchievements });
    }
    
    // Emit to connected clients
    io.emit('batchUpdated', updatedBatch);
    
    res.json(updatedBatch);
  } catch (error) {
    console.error('Error marking batch as harvested:', error);
    res.status(500).json({ error: 'Failed to mark batch as harvested' });
  }
});

// Sell pupae
app.post('/api/marketplace/sell-pupae', auth.authenticateToken, async (req, res) => {
  try {
    const { cageId, salePrice } = req.body;
    
    if (!cageId || !salePrice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const batch = await Database.getBatchByCageId(cageId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    // Verify batch is harvested and belongs to seller
    if (batch.status !== 'harvested' || batch.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Cannot sell this batch' });
    }
    
    // Add to pupae sales history
    const saleData = {
      batchId: cageId,
      species: batch.species,
      larvalCount: batch.larval_count,
      qualityScore: batch.quality_score,
      hostPlant: batch.host_plant,
      finalSalePrice: salePrice,
      sellerId: req.user.id,
      sellerName: req.user.name || req.user.username,
      sellerUsername: req.user.username,
      sellerRole: req.user.role,
      salesHistory: []
    };
    
    const sale = await Database.addPupaeSale(saleData);
    
    // Update batch status to sold
    await Database.updateBatch(cageId, {
      status: 'sold'
    });
    
    await logActivity(cageId, `Pupae sold for ₱${salePrice}`, 'Pupa', req.user.id);
    
    // Update achievement progress
    const newAchievements = await achievementSystem.updateUserStats(req.user.id, 'pupaeSold', 1, { salePrice });
    if (newAchievements.length > 0) {
      io.emit('achievementUnlocked', { userId: req.user.id, achievements: newAchievements });
    }
    
    // Emit to connected clients
    io.emit('pupaeSold', { cageId, salePrice, sellerId: req.user.id });
    
    res.json({ success: true, sale });
  } catch (error) {
    console.error('Error selling pupae:', error);
    res.status(500).json({ error: 'Failed to sell pupae' });
  }
});

// Purchase pupae
app.post('/api/marketplace/purchase-pupae', auth.authenticateToken, async (req, res) => {
  try {
    const { saleId, paymentMethod = 'GCash' } = req.body;
    
    if (!saleId) {
      return res.status(400).json({ error: 'Missing sale ID' });
    }
    
    // Get sale information from pupae sales
    const sales = await Database.getPupaeSalesHistory();
    const sale = sales.find(s => s.id === saleId);
    
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    // Create order for the purchase
    const orderData = {
      orderId: `ORDER-${Date.now()}`,
      buyerId: req.user.id,
      sellerId: sale.seller_id,
      batchId: sale.batch_id,
      lifecycleStage: 'Pupa',
      species: sale.species,
      quantity: sale.larval_count,
      pricePerUnit: sale.final_sale_price / sale.larval_count,
      totalAmount: sale.final_sale_price
    };
    
    const order = await Database.createOrder(orderData);
    
    // Create payment
    const paymentData = {
      paymentId: `PAY-${Date.now()}`,
      orderId: order.id,
      payerId: req.user.id,
      amount: sale.final_sale_price,
      paymentMethod: paymentMethod,
      referenceNumber: `REF-${Date.now()}`
    };
    
    const payment = await Database.createPayment(paymentData);
    
    await logActivity(sale.batch_id, `Pupae purchased by ${req.user.username} for ₱${sale.final_sale_price}`, 'Pupa', req.user.id);
    
    // Update achievement progress
    const newAchievements = await achievementSystem.updateUserStats(req.user.id, 'pupaePurchased', 1, { purchasePrice: sale.final_sale_price });
    if (newAchievements.length > 0) {
      io.emit('achievementUnlocked', { userId: req.user.id, achievements: newAchievements });
    }
    
    // Emit to connected clients
    io.emit('pupaePurchased', { orderId: order.order_id, buyerId: req.user.id, sellerId: sale.seller_id });
    
    res.json({ success: true, order, payment });
  } catch (error) {
    console.error('Error purchasing pupae:', error);
    res.status(500).json({ error: 'Failed to purchase pupae' });
  }
});

// Remove batch from sale
app.post('/api/batches/:cageId/remove-from-sale', auth.authenticateToken, auth.requirePermission('update_batches'), async (req, res) => {
  try {
    const { cageId } = req.params;
    
    const batches = await loadBatches();
    const batchIndex = batches.findIndex(b => b.cageId === cageId);
    
    if (batchIndex === -1) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    const batch = batches[batchIndex];
    
    // Remove from marketplace
    batch.forSale = false;
    delete batch.salePrice;
    delete batch.saleDescription;
    delete batch.availableDate;
    
    batches[batchIndex] = batch;
    await saveBatches(batches);
    
    await logActivity(req.user.id, `Batch removed from sale: ${cageId}`, batch.lifecycleStage);
    
    res.json({ message: 'Batch removed from sale successfully' });
  } catch (error) {
    console.error('Error removing batch from sale:', error);
    res.status(500).json({ error: 'Failed to remove batch from sale' });
  }
});

// Achievement System API Routes
app.get('/api/achievements/user/:userId', auth.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Only allow users to view their own achievements or admins to view any
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const userProgress = achievementSystem.getUserProgress(userId);
    res.json(userProgress);
  } catch (error) {
    console.error('Error fetching user achievements:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

app.get('/api/achievements/leaderboard', auth.authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const leaderboard = achievementSystem.getLeaderboard(limit);
    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

app.get('/api/achievements/categories', auth.authenticateToken, async (req, res) => {
  try {
    const categories = ['breeding', 'lifecycle', 'diversity', 'quality', 'survival', 'care', 'profit', 'special', 'consistency'];
    const achievementsByCategory = {};
    
    categories.forEach(category => {
      achievementsByCategory[category] = achievementSystem.getAchievementsByCategory(category);
    });
    
    res.json(achievementsByCategory);
  } catch (error) {
    console.error('Error fetching achievement categories:', error);
    res.status(500).json({ error: 'Failed to fetch achievement categories' });
  }
});

app.post('/api/achievements/mark-early-adopter/:userId', auth.authenticateToken, auth.requirePermission('manage_achievements'), async (req, res) => {
  try {
    const { userId } = req.params;
    const newAchievements = await achievementSystem.markEarlyAdopter(userId);
    
    if (newAchievements.length > 0) {
      io.emit('achievementUnlocked', { userId, achievements: newAchievements });
    }
    
    res.json({ message: 'Early adopter status granted', achievements: newAchievements });
  } catch (error) {
    console.error('Error marking early adopter:', error);
    res.status(500).json({ error: 'Failed to mark early adopter' });
  }
});

// Test SMS notification endpoint
app.post('/api/sms/test', auth.authenticateToken, async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ error: 'Phone number and message are required' });
    }
    
    // Check if Twilio is configured
    if (!twilioClient) {
      return res.status(500).json({ error: 'Twilio SMS service not configured' });
    }
    
    const success = await sendSMSNotification(phoneNumber, message);
    
    if (success) {
      await logActivity(req.user.id, `Test SMS sent to ${phoneNumber}`, null);
      res.json({ success: true, message: 'SMS sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send SMS. Please check your Twilio phone number configuration.' });
    }
  } catch (error) {
    console.error('Error sending test SMS:', error);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

// Get marketplace listings
app.get('/api/marketplace/pupae', async (req, res) => {
  try {
    const listings = await Database.getPupaeSalesHistory();
    
    // Filter for available listings and add additional info
    const availableListings = listings
      .filter(listing => listing.status === 'available')
      .map(listing => ({
        ...listing,
        speciesInfo: BUTTERFLY_SPECIES_INFO[listing.species] || {},
        daysOld: Math.floor((new Date() - new Date(listing.listed_date)) / (1000 * 60 * 60 * 24))
      }));
    
    res.json(availableListings);
  } catch (error) {
    console.error('Error fetching marketplace listings:', error);
    res.status(500).json({ error: 'Failed to fetch marketplace listings' });
  }
});

// Test endpoint for auto-listing (admin only)
app.post('/api/test/auto-list', auth.authenticateToken, auth.requirePermission('*'), async (req, res) => {
  try {
    const { cageId } = req.body;
    
    if (!cageId) {
      return res.status(400).json({ error: 'cageId required' });
    }
    
    const batches = await loadBatches();
    const batch = batches.find(b => b.cageId === cageId);
    
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    if (batch.lifecycleStage !== 'Pupa') {
      return res.status(400).json({ error: 'Batch must be in Pupa stage' });
    }
    
    // Force auto-listing for testing
    batch.pupaeStageDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(); // 4 days ago
    batch.listedForSale = false;
    
    await saveBatches(batches);
    await checkPupaeForSale(batch, new Date());
    
    res.json({ 
      message: 'Auto-listing test triggered', 
      batch,
      pupaeAge: Math.floor((new Date() - new Date(batch.pupaeStageDate)) / (1000 * 60 * 60 * 24))
    });
  } catch (error) {
    console.error('Error in auto-listing test:', error);
    res.status(500).json({ error: 'Failed to test auto-listing' });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
  
  // Handle manual feeding schedule check
  socket.on('checkFeeding', async () => {
    await checkFeedingSchedule();
  });
});

// User Profile API Endpoints

// Get user profile by ID
app.get('/api/users/:userId', auth.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const users = await auth.getAllUsers();
    
    const user = users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Return public profile information (exclude sensitive data)
    const publicProfile = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      organization: user.organization,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    };
    
    res.json(publicProfile);
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Get user statistics
app.get('/api/users/:userId/stats', auth.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const batches = await loadBatches();
    const orders = await paymentProcessor.getUserOrders(userId, 'seller');
    const purchases = await paymentProcessor.getUserOrders(userId, 'buyer');
    
    // Calculate user statistics
    const userBatches = batches.filter(batch => batch.createdBy === userId);
    const activeListings = userBatches.filter(batch => batch.active && batch.forSale);
    const completedSales = orders.filter(order => order.status === 'completed');
    
    const stats = {
      totalListings: userBatches.length,
      activeListings: activeListings.length,
      totalSales: completedSales.length,
      totalRevenue: completedSales.reduce((sum, order) => sum + order.totalAmount, 0),
      totalPurchases: purchases.length,
      memberSince: new Date(userBatches[0]?.startDate || new Date()).getFullYear()
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ error: 'Failed to get user stats' });
  }
});

// Get user profile data with portfolio
app.get('/api/profile/:userId', auth.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user information from database
    const user = await Database.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get user's batches
    const batches = await Database.getAllBatches();
    const userBatches = batches.filter(batch => batch.created_by === userId);
    
    // Get user's orders (as buyer)
    const buyerOrders = await paymentProcessor.getUserOrders(userId, 'buyer');
    
    // Get user's orders (as seller)
    const sellerOrders = await paymentProcessor.getUserOrders(userId, 'seller');
    
    // Get user achievements
    const achievements = await Database.getUserAchievements(userId);
    
    // Get user progress
    const progress = await Database.getUserProgress(userId);
    
    // Calculate statistics
    const totalBatches = userBatches.length;
    const activeBatches = userBatches.filter(batch => batch.status === 'active').length;
    const completedBatches = userBatches.filter(batch => batch.status === 'completed').length;
    const totalSales = sellerOrders.filter(order => order.status === 'completed').length;
    const totalRevenue = sellerOrders
      .filter(order => order.status === 'completed')
      .reduce((sum, order) => sum + order.totalAmount, 0);
    
    // Get species diversity
    const speciesCount = new Set(userBatches.map(batch => batch.species)).size;
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        phone_number: user.phone_number,
        created_at: user.created_at
      },
      batches: userBatches,
      purchases: buyerOrders,
      sales: sellerOrders,
      achievements: achievements || [],
      progress: progress || {},
      statistics: {
        totalBatches,
        activeBatches,
        completedBatches,
        totalSales,
        totalRevenue,
        speciesCount
      }
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Get user listings (batches for sale)
app.get('/api/users/:userId/listings', auth.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const batches = await Database.getAllBatches();
    
    const userListings = batches
      .filter(batch => batch.created_by === userId && batch.status === 'active')
      .map(batch => {
        const cageBatch = new CageBatch();
        Object.assign(cageBatch, batch);
        const profitData = cageBatch.calculateProfitProjection();
        
        return {
          id: batch.cage_id,
          title: `${batch.species} - ${batch.lifecycle_stage}`,
          description: batch.notes,
          price: profitData.revenue,
          category: batch.species,
          createdAt: batch.start_date,
          views: batch.views || 0,
          status: batch.status,
          images: batch.images || []
        };
      });
    
    res.json(userListings);
  } catch (error) {
    console.error('Error getting user listings:', error);
    res.status(500).json({ error: 'Failed to get user listings' });
  }
});

// Get user purchases
app.get('/api/users/:userId/purchases', auth.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const purchases = await paymentProcessor.getUserOrders(userId, 'buyer');
    
    const purchaseDetails = purchases.map(order => ({
      id: order.id,
      title: order.items.map(item => `${item.species} - ${item.quantity}x`).join(', '),
      description: order.notes || 'No description',
      price: order.totalAmount,
      purchaseDate: order.createdAt,
      status: order.status,
      sellerName: order.sellerInfo?.name || 'Unknown',
      sellerId: order.sellerInfo?.id
    }));
    
    res.json(purchaseDetails);
  } catch (error) {
    console.error('Error getting user purchases:', error);
    res.status(500).json({ error: 'Failed to get user purchases' });
  }
});

// Initialize the application
async function startServer() {
  console.log('🚀 Starting Butterfly Breeding Management System with PostgreSQL database...');
  
  // Test database connection
  try {
    await Database.query('SELECT NOW()');
    console.log('✅ PostgreSQL database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.log('⚠️ Continuing with limited functionality...');
  }
  
  await initializeDataDir();
  
  // Initialize authentication system
  await auth.initializeUsers();
  
  // Initialize CNN models
  await cnnModelManager.initialize();
  
  // Initialize payment system
  await paymentProcessor.initialize();
  
  // Initialize achievement system
  await achievementSystem.initialize();
  
  const PORT = process.env.PORT || 5000;
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🦋 Butterfly Breeding Management System running on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    
    if (!twilioClient) {
      console.warn('⚠️  Twilio not configured. SMS notifications disabled.');
      console.log('   Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER');
    } else {
      console.log('📱 SMS notifications enabled');
    }
    
    console.log('🔐 Authentication system ready');
    console.log('🧠 CNN models initialized');
    console.log('🏆 Achievement system ready');
    console.log('👤 Default admin login: username=admin, password=admin123');
  });
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();