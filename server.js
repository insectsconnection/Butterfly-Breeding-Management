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
const { cnnModelManager, CLASSIFICATION_LABELS, SPECIES_MARKET_PRICES, SPECIES_HOST_PLANTS } = require('./cnn-models');
const { paymentProcessor, PAYMENT_STATUS, PAYMENT_METHODS } = require('./payment-system');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

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
const LIFECYCLE_STAGES = ["Egg", "Larva", "Pupa", "Adult"];

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
    if (LIFECYCLE_STAGES.includes(stage)) {
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

// Data management functions
async function loadBatches() {
  try {
    const data = await fs.readFile(BATCHES_FILE, 'utf8');
    const batches = JSON.parse(data);
    return batches.map(batch => {
      // Convert date strings back to Date objects
      batch.startDate = new Date(batch.startDate);
      batch.lastFeeding = new Date(batch.lastFeeding);
      batch.nextFeeding = new Date(batch.nextFeeding);
      return batch;
    });
  } catch (error) {
    console.error('Error loading batches:', error);
    return [];
  }
}

async function saveBatches(batches) {
  try {
    await fs.writeFile(BATCHES_FILE, JSON.stringify(batches, null, 2));
  } catch (error) {
    console.error('Error saving batches:', error);
  }
}

async function loadBreedingLog() {
  try {
    const data = await fs.readFile(BREEDING_LOG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading breeding log:', error);
    return [];
  }
}

async function saveBreedingLog(log) {
  try {
    await fs.writeFile(BREEDING_LOG_FILE, JSON.stringify(log, null, 2));
  } catch (error) {
    console.error('Error saving breeding log:', error);
  }
}

async function logActivity(cageId, activity, lifecycleStage = null) {
  const log = await loadBreedingLog();
  const entry = {
    id: uuidv4(),
    cageId: cageId,
    timestamp: new Date(),
    activity: activity,
    lifecycleStage: lifecycleStage
  };
  
  log.push(entry);
  await saveBreedingLog(log);
  
  // Emit to connected clients
  io.emit('activityLog', entry);
  
  return entry;
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
      marketPrice: SPECIES_MARKET_PRICES[species] || 25.00
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

// Create new batch
app.post('/api/batches', auth.authenticateToken, auth.requirePermission('create_batches'), async (req, res) => {
  try {
    const { species, larvaCount, phoneNumber, notes } = req.body;
    
    if (!species || !larvaCount || !phoneNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const batch = new CageBatch(species, new Date(), larvaCount, phoneNumber);
    batch.notes = notes || '';
    
    const batches = await loadBatches();
    batches.push(batch);
    await saveBatches(batches);
    
    // Generate QR code for the batch
    const qrData = {
      cageId: batch.cageId,
      species: batch.species,
      created: batch.startDate
    };
    batch.qrCode = await generateQRCode(qrData);
    
    await logActivity(batch.cageId, 'Batch created', batch.lifecycleStage);
    
    // Emit to connected clients
    io.emit('batchCreated', batch);
    
    res.status(201).json(batch);
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
    
    // Handle lifecycle stage updates
    if (updates.lifecycleStage && updates.lifecycleStage !== batch.lifecycleStage) {
      await logActivity(cageId, `Lifecycle stage updated to ${updates.lifecycleStage}`, updates.lifecycleStage);
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
    
    await saveBatches(batches);
    await logActivity(cageId, 'Batch fed', batch.lifecycleStage);
    
    // Emit to connected clients
    io.emit('batchFed', batch);
    
    res.json({ message: 'Batch marked as fed', batch });
  } catch (error) {
    console.error('Error marking batch as fed:', error);
    res.status(500).json({ error: 'Failed to mark batch as fed' });
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
    
    // Filter for batches available for sale
    const marketplaceItems = batches
      .filter(batch => batch.active && batch.forSale)
      .map(batch => {
        const cageBatch = new CageBatch();
        Object.assign(cageBatch, batch);
        const profitData = cageBatch.calculateProfitProjection();
        
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
            location: batch.sellerLocation || 'Not specified',
            rating: batch.sellerRating || 5.0
          },
          images: batch.images || [],
          description: batch.notes,
          availableDate: batch.availableDate || new Date().toISOString(),
          createdAt: batch.startDate
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
    batch.sellerLocation = sellerLocation;
    batch.sellerRating = 5.0; // Default rating
    
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

// Initialize the application
async function startServer() {
  await initializeDataDir();
  
  // Initialize authentication system
  await auth.initializeUsers();
  
  // Initialize CNN models
  await cnnModelManager.initialize();
  
  // Initialize payment system
  await paymentProcessor.initialize();
  
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