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

// Host plant requirements database
const HOST_PLANT_REQUIREMENTS = {
  "Common Mormon": { plant: "Citrus", dailyConsumption: 150, marketPrice: 25.00 },
  "Atlas Moth": { plant: "Cinnamon", dailyConsumption: 200, marketPrice: 35.00 },
  "Blue Morpho": { plant: "Pea Family", dailyConsumption: 180, marketPrice: 45.00 },
  "Swallowtail": { plant: "Parsley", dailyConsumption: 120, marketPrice: 20.00 },
  "Monarch": { plant: "Milkweed", dailyConsumption: 140, marketPrice: 30.00 },
  "Cabbage White": { plant: "Brassica", dailyConsumption: 100, marketPrice: 15.00 },
  "Zebra Longwing": { plant: "Passion Vine", dailyConsumption: 160, marketPrice: 28.00 },
  "Giant Swallowtail": { plant: "Citrus", dailyConsumption: 220, marketPrice: 40.00 }
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

// API Routes

// Get all batches
app.get('/api/batches', async (req, res) => {
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
app.post('/api/batches', async (req, res) => {
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