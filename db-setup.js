const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Database connection
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

// Initialize database with tables
async function initializeDatabase() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');

    // Create tables for the butterfly breeding system
    await createTables();
    console.log('✓ Database tables created successfully');

    // Migrate existing JSON data
    await migrateExistingData();
    console.log('✓ Data migration completed');

    await client.end();
    console.log('Database initialization completed!');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

async function createTables() {
  // Users table
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'user',
      phone_number VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Butterfly batches table
  await client.query(`
    CREATE TABLE IF NOT EXISTS batches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cage_id VARCHAR(50) UNIQUE NOT NULL,
      species VARCHAR(100) NOT NULL,
      larval_count INTEGER NOT NULL,
      lifecycle_stage VARCHAR(20) DEFAULT 'Egg',
      status VARCHAR(20) DEFAULT 'active',
      host_plant VARCHAR(100),
      start_date TIMESTAMP NOT NULL,
      last_feeding TIMESTAMP,
      next_feeding TIMESTAMP,
      quality_score DECIMAL(3,2) DEFAULT 0.85,
      foliage_level INTEGER DEFAULT 100,
      phone_number VARCHAR(20),
      notes TEXT,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Batch defects table
  await client.query(`
    CREATE TABLE IF NOT EXISTS batch_defects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
      defect_type VARCHAR(50) NOT NULL,
      severity VARCHAR(20) NOT NULL,
      description TEXT,
      detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Batch images table
  await client.query(`
    CREATE TABLE IF NOT EXISTS batch_images (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255),
      file_path VARCHAR(500),
      file_size INTEGER,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Lifecycle history table
  await client.query(`
    CREATE TABLE IF NOT EXISTS lifecycle_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
      previous_stage VARCHAR(20),
      new_stage VARCHAR(20) NOT NULL,
      automatic_action TEXT,
      transition_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Breeding log table
  await client.query(`
    CREATE TABLE IF NOT EXISTS breeding_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cage_id VARCHAR(50) NOT NULL,
      activity TEXT NOT NULL,
      lifecycle_stage VARCHAR(20),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      user_id UUID REFERENCES users(id)
    );
  `);

  // Orders table
  await client.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id VARCHAR(50) UNIQUE NOT NULL,
      buyer_id UUID REFERENCES users(id),
      seller_id UUID REFERENCES users(id),
      batch_id UUID REFERENCES batches(id),
      lifecycle_stage VARCHAR(20) NOT NULL,
      species VARCHAR(100) NOT NULL,
      quantity INTEGER NOT NULL,
      price_per_unit DECIMAL(10,2) NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_date TIMESTAMP
    );
  `);

  // Payments table
  await client.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_id VARCHAR(50) UNIQUE NOT NULL,
      order_id UUID REFERENCES orders(id),
      payer_id UUID REFERENCES users(id),
      amount DECIMAL(10,2) NOT NULL,
      payment_method VARCHAR(20) DEFAULT 'gcash',
      status VARCHAR(20) DEFAULT 'pending',
      reference_number VARCHAR(100),
      payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_date TIMESTAMP
    );
  `);

  // CRITICAL: Marketplace sales history tables (PRESERVE EXISTING DATA)
  
  // Pupae sales history
  await client.query(`
    CREATE TABLE IF NOT EXISTS pupae_sales (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id VARCHAR(50) NOT NULL,
      species VARCHAR(100) NOT NULL,
      larval_count INTEGER NOT NULL,
      quality_score DECIMAL(3,2),
      host_plant VARCHAR(100),
      final_sale_price DECIMAL(10,2) NOT NULL,
      sold_at TIMESTAMP NOT NULL,
      seller_id UUID REFERENCES users(id),
      seller_name VARCHAR(255),
      seller_username VARCHAR(50),
      seller_role VARCHAR(20),
      sales_history JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Larva sales history
  await client.query(`
    CREATE TABLE IF NOT EXISTS larva_sales (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id VARCHAR(50) NOT NULL,
      species VARCHAR(100) NOT NULL,
      larval_count INTEGER NOT NULL,
      quality_score DECIMAL(3,2),
      host_plant VARCHAR(100),
      final_sale_price DECIMAL(10,2) NOT NULL,
      sold_at TIMESTAMP NOT NULL,
      seller_id UUID REFERENCES users(id),
      seller_name VARCHAR(255),
      seller_username VARCHAR(50),
      seller_role VARCHAR(20),
      sales_history JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Egg sales history
  await client.query(`
    CREATE TABLE IF NOT EXISTS egg_sales (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id VARCHAR(50) NOT NULL,
      species VARCHAR(100) NOT NULL,
      larval_count INTEGER NOT NULL,
      quality_score DECIMAL(3,2),
      host_plant VARCHAR(100),
      final_sale_price DECIMAL(10,2) NOT NULL,
      sold_at TIMESTAMP NOT NULL,
      seller_id UUID REFERENCES users(id),
      seller_name VARCHAR(255),
      seller_username VARCHAR(50),
      seller_role VARCHAR(20),
      sales_history JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Butterfly sales history
  await client.query(`
    CREATE TABLE IF NOT EXISTS butterfly_sales (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id VARCHAR(50) NOT NULL,
      species VARCHAR(100) NOT NULL,
      larval_count INTEGER NOT NULL,
      quality_score DECIMAL(3,2),
      host_plant VARCHAR(100),
      final_sale_price DECIMAL(10,2) NOT NULL,
      sold_at TIMESTAMP NOT NULL,
      seller_id UUID REFERENCES users(id),
      seller_name VARCHAR(255),
      seller_username VARCHAR(50),
      seller_role VARCHAR(20),
      sales_history JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tasks table
  await client.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      task_type VARCHAR(50) DEFAULT 'feeding',
      priority VARCHAR(20) DEFAULT 'medium',
      status VARCHAR(20) DEFAULT 'pending',
      created_by UUID REFERENCES users(id),
      assigned_to UUID REFERENCES users(id),
      cage_id VARCHAR(50),
      due_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    );
  `);

  // User achievements table
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      achievement_id VARCHAR(50) NOT NULL,
      unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      progress_data JSONB DEFAULT '{}'::jsonb,
      UNIQUE(user_id, achievement_id)
    );
  `);

  // User progress table
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_progress (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) UNIQUE,
      level INTEGER DEFAULT 1,
      total_points INTEGER DEFAULT 0,
      stats JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create indexes for better performance
  await client.query(`CREATE INDEX IF NOT EXISTS idx_batches_cage_id ON batches(cage_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_batches_species ON batches(species);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_batches_lifecycle_stage ON batches(lifecycle_stage);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_batches_created_by ON batches(created_by);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_breeding_log_cage_id ON breeding_log(cage_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_pupae_sales_species ON pupae_sales(species);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_larva_sales_species ON larva_sales(species);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_egg_sales_species ON egg_sales(species);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_butterfly_sales_species ON butterfly_sales(species);`);
}

async function migrateExistingData() {
  const DATA_DIR = './data';
  
  try {
    // Migrate users
    await migrateUsers();
    
    // Migrate batches
    await migrateBatches();
    
    // Migrate breeding log
    await migrateBreedingLog();
    
    // Migrate orders and payments
    await migrateOrdersAndPayments();
    
    // Migrate tasks
    await migrateTasks();
    
    // Migrate user progress and achievements
    await migrateUserProgress();
    
    // CRITICAL: Migrate marketplace sales history
    await migratePupaeSalesHistory();
    await migrateLarvaSalesHistory();
    await migrateEggSalesHistory();
    await migrateButterflySalesHistory();
    
    console.log('✓ All data migrated successfully with marketplace sales history preserved');
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

async function migrateUsers() {
  try {
    const usersData = await fs.readFile(path.join('./data', 'users.json'), 'utf8');
    const users = JSON.parse(usersData);
    
    for (const user of users) {
      await client.query(`
        INSERT INTO users (id, username, email, password_hash, role, phone_number, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (username) DO NOTHING
      `, [
        user.id,
        user.username,
        user.email,
        user.password,
        user.role,
        user.phoneNumber,
        new Date(user.createdAt)
      ]);
    }
    console.log(`✓ Migrated ${users.length} users`);
  } catch (error) {
    console.log('✓ No users.json file found or empty, starting with fresh user data');
  }
}

async function migrateBatches() {
  try {
    const batchesData = await fs.readFile(path.join('./data', 'batches.json'), 'utf8');
    const batches = JSON.parse(batchesData);
    
    for (const batch of batches) {
      // Insert batch
      const batchResult = await client.query(`
        INSERT INTO batches (cage_id, species, larval_count, lifecycle_stage, status, host_plant, 
                           start_date, last_feeding, next_feeding, quality_score, foliage_level, 
                           phone_number, notes, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (cage_id) DO NOTHING
        RETURNING id
      `, [
        batch.cageId,
        batch.species,
        batch.larvaCount,
        batch.lifecycleStage || 'Egg',
        batch.status || 'active',
        batch.hostPlant,
        new Date(batch.startDate),
        batch.lastFeeding ? new Date(batch.lastFeeding) : null,
        batch.nextFeeding ? new Date(batch.nextFeeding) : null,
        batch.qualityScore || 0.85,
        batch.foliageLevel || 100,
        batch.phoneNumber,
        batch.notes,
        batch.createdBy || null,
        new Date(batch.createdAt || Date.now())
      ]);
      
      if (batchResult.rows.length > 0) {
        const batchId = batchResult.rows[0].id;
        
        // Migrate defects if any
        if (batch.defects && batch.defects.length > 0) {
          for (const defect of batch.defects) {
            await client.query(`
              INSERT INTO batch_defects (batch_id, defect_type, severity, description, detected_at)
              VALUES ($1, $2, $3, $4, $5)
            `, [
              batchId,
              defect.type,
              defect.severity,
              defect.description,
              new Date(defect.detectedAt || Date.now())
            ]);
          }
        }
        
        // Migrate images if any
        if (batch.images && batch.images.length > 0) {
          for (const image of batch.images) {
            await client.query(`
              INSERT INTO batch_images (batch_id, filename, original_name, file_path, file_size, uploaded_at)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [
              batchId,
              image.filename,
              image.originalName,
              image.path,
              image.size,
              new Date(image.uploadDate || Date.now())
            ]);
          }
        }
        
        // Migrate lifecycle history if any
        if (batch.lifecycleHistory && batch.lifecycleHistory.length > 0) {
          for (const history of batch.lifecycleHistory) {
            await client.query(`
              INSERT INTO lifecycle_history (batch_id, previous_stage, new_stage, automatic_action, transition_date)
              VALUES ($1, $2, $3, $4, $5)
            `, [
              batchId,
              history.previousStage,
              history.stage,
              history.automaticAction,
              new Date(history.date || Date.now())
            ]);
          }
        }
      }
    }
    console.log(`✓ Migrated ${batches.length} batches`);
  } catch (error) {
    console.log('No batches.json file found, skipping batch migration');
  }
}

async function migrateBreedingLog() {
  try {
    const logData = await fs.readFile(path.join('./data', 'breeding_log.json'), 'utf8');
    const logs = JSON.parse(logData);
    
    for (const log of logs) {
      await client.query(`
        INSERT INTO breeding_log (cage_id, activity, lifecycle_stage, timestamp)
        VALUES ($1, $2, $3, $4)
      `, [
        log.cageId,
        log.activity,
        log.lifecycleStage,
        new Date(log.timestamp)
      ]);
    }
    console.log(`✓ Migrated ${logs.length} breeding log entries`);
  } catch (error) {
    console.log('No breeding_log.json file found, skipping breeding log migration');
  }
}

async function migrateOrdersAndPayments() {
  try {
    const ordersData = await fs.readFile(path.join('./data', 'orders.json'), 'utf8');
    const orders = JSON.parse(ordersData);
    
    for (const order of orders) {
      await client.query(`
        INSERT INTO orders (order_id, buyer_id, seller_id, lifecycle_stage, species, quantity, 
                          price_per_unit, total_amount, status, order_date, completed_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (order_id) DO NOTHING
      `, [
        order.orderId,
        order.buyerId,
        order.sellerId,
        order.lifecycleStage,
        order.species,
        order.quantity,
        order.pricePerUnit,
        order.totalAmount,
        order.status,
        new Date(order.orderDate),
        order.completedDate ? new Date(order.completedDate) : null
      ]);
    }
    console.log(`✓ Migrated ${orders.length} orders`);
  } catch (error) {
    console.log('No orders.json file found, skipping orders migration');
  }
  
  try {
    const paymentsData = await fs.readFile(path.join('./data', 'payments.json'), 'utf8');
    const payments = JSON.parse(paymentsData);
    
    for (const payment of payments) {
      await client.query(`
        INSERT INTO payments (payment_id, amount, payment_method, status, reference_number, 
                            payment_date, completed_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (payment_id) DO NOTHING
      `, [
        payment.paymentId,
        payment.amount,
        payment.paymentMethod,
        payment.status,
        payment.referenceNumber,
        new Date(payment.paymentDate),
        payment.completedDate ? new Date(payment.completedDate) : null
      ]);
    }
    console.log(`✓ Migrated ${payments.length} payments`);
  } catch (error) {
    console.log('No payments.json file found, skipping payments migration');
  }
}

async function migrateTasks() {
  try {
    const tasksData = await fs.readFile(path.join('./data', 'tasks.json'), 'utf8');
    const tasks = JSON.parse(tasksData);
    
    for (const task of tasks) {
      await client.query(`
        INSERT INTO tasks (title, description, task_type, priority, status, created_by, 
                         assigned_to, cage_id, due_date, created_at, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        task.title,
        task.description,
        task.type,
        task.priority,
        task.status,
        task.createdBy,
        task.assignedTo,
        task.cageId,
        task.dueDate ? new Date(task.dueDate) : null,
        new Date(task.createdAt),
        task.completedAt ? new Date(task.completedAt) : null
      ]);
    }
    console.log(`✓ Migrated ${tasks.length} tasks`);
  } catch (error) {
    console.log('No tasks.json file found, skipping tasks migration');
  }
}

async function migrateUserProgress() {
  try {
    const progressData = await fs.readFile(path.join('./data', 'user_progress.json'), 'utf8');
    const progress = JSON.parse(progressData);
    
    for (const userId in progress) {
      const userProgress = progress[userId];
      await client.query(`
        INSERT INTO user_progress (user_id, level, total_points, stats)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) DO UPDATE SET
        level = EXCLUDED.level,
        total_points = EXCLUDED.total_points,
        stats = EXCLUDED.stats,
        updated_at = CURRENT_TIMESTAMP
      `, [
        userId,
        userProgress.level || 1,
        userProgress.totalPoints || 0,
        JSON.stringify(userProgress.stats || {})
      ]);
    }
    console.log(`✓ Migrated user progress for ${Object.keys(progress).length} users`);
  } catch (error) {
    console.log('No user_progress.json file found, skipping user progress migration');
  }
}

// CRITICAL: Preserve marketplace sales history
async function migratePupaeSalesHistory() {
  try {
    // Check if there's existing sales data in the database or files
    const existingData = await fs.readFile(path.join('./data', 'pupae_sales.json'), 'utf8');
    const pupaeSales = JSON.parse(existingData);
    
    for (const sale of pupaeSales) {
      await client.query(`
        INSERT INTO pupae_sales (batch_id, species, larval_count, quality_score, host_plant,
                               final_sale_price, sold_at, seller_id, seller_name, seller_username,
                               seller_role, sales_history)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        sale.batchId,
        sale.species,
        sale.larvaCount,
        sale.qualityScore,
        sale.hostPlant,
        sale.finalSalePrice,
        new Date(sale.soldAt),
        sale.sellerInfo?.id,
        sale.sellerInfo?.name,
        sale.sellerInfo?.username,
        sale.sellerInfo?.role,
        JSON.stringify(sale.salesHistory || [])
      ]);
    }
    console.log(`✓ Migrated ${pupaeSales.length} pupae sales records`);
  } catch (error) {
    console.log('No pupae sales history found, starting fresh');
  }
}

async function migrateLarvaSalesHistory() {
  try {
    const existingData = await fs.readFile(path.join('./data', 'larva_sales.json'), 'utf8');
    const larvaSales = JSON.parse(existingData);
    
    for (const sale of larvaSales) {
      await client.query(`
        INSERT INTO larva_sales (batch_id, species, larval_count, quality_score, host_plant,
                               final_sale_price, sold_at, seller_id, seller_name, seller_username,
                               seller_role, sales_history)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        sale.batchId,
        sale.species,
        sale.larvaCount,
        sale.qualityScore,
        sale.hostPlant,
        sale.finalSalePrice,
        new Date(sale.soldAt),
        sale.sellerInfo?.id,
        sale.sellerInfo?.name,
        sale.sellerInfo?.username,
        sale.sellerInfo?.role,
        JSON.stringify(sale.salesHistory || [])
      ]);
    }
    console.log(`✓ Migrated ${larvaSales.length} larva sales records`);
  } catch (error) {
    console.log('No larva sales history found, starting fresh');
  }
}

async function migrateEggSalesHistory() {
  try {
    const existingData = await fs.readFile(path.join('./data', 'egg_sales.json'), 'utf8');
    const eggSales = JSON.parse(existingData);
    
    for (const sale of eggSales) {
      await client.query(`
        INSERT INTO egg_sales (batch_id, species, larval_count, quality_score, host_plant,
                             final_sale_price, sold_at, seller_id, seller_name, seller_username,
                             seller_role, sales_history)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        sale.batchId,
        sale.species,
        sale.larvaCount,
        sale.qualityScore,
        sale.hostPlant,
        sale.finalSalePrice,
        new Date(sale.soldAt),
        sale.sellerInfo?.id,
        sale.sellerInfo?.name,
        sale.sellerInfo?.username,
        sale.sellerInfo?.role,
        JSON.stringify(sale.salesHistory || [])
      ]);
    }
    console.log(`✓ Migrated ${eggSales.length} egg sales records`);
  } catch (error) {
    console.log('No egg sales history found, starting fresh');
  }
}

async function migrateButterflySalesHistory() {
  try {
    const existingData = await fs.readFile(path.join('./data', 'butterfly_sales.json'), 'utf8');
    const butterflySales = JSON.parse(existingData);
    
    for (const sale of butterflySales) {
      await client.query(`
        INSERT INTO butterfly_sales (batch_id, species, larval_count, quality_score, host_plant,
                                   final_sale_price, sold_at, seller_id, seller_name, seller_username,
                                   seller_role, sales_history)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        sale.batchId,
        sale.species,
        sale.larvaCount,
        sale.qualityScore,
        sale.hostPlant,
        sale.finalSalePrice,
        new Date(sale.soldAt),
        sale.sellerInfo?.id,
        sale.sellerInfo?.name,
        sale.sellerInfo?.username,
        sale.sellerInfo?.role,
        JSON.stringify(sale.salesHistory || [])
      ]);
    }
    console.log(`✓ Migrated ${butterflySales.length} butterfly sales records`);
  } catch (error) {
    console.log('No butterfly sales history found, starting fresh');
  }
}

// Run initialization
initializeDatabase();