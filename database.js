const { Client, Pool } = require('pg');

// Create connection pool for better performance
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  acquireTimeoutMillis: 60000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Database operations for butterfly breeding system
class Database {
  // User operations
  static async createUser(userData) {
    const { username, email, password, role, phoneNumber } = userData;
    const result = await pool.query(`
      INSERT INTO users (username, email, password_hash, role, phone_number)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, email, role, phone_number, created_at
    `, [username, email, password, role, phoneNumber]);
    return result.rows[0];
  }

  static async getUserByUsername(username) {
    const result = await pool.query(`
      SELECT id, username, email, password_hash, role, phone_number, created_at
      FROM users WHERE username = $1
    `, [username]);
    return result.rows[0];
  }

  static async getUserById(userId) {
    const result = await pool.query(`
      SELECT id, username, email, role, phone_number, created_at
      FROM users WHERE id = $1
    `, [userId]);
    return result.rows[0];
  }

  static async getAllUsers() {
    const result = await pool.query(`
      SELECT id, username, email, role, phone_number, created_at
      FROM users ORDER BY created_at DESC
    `);
    return result.rows;
  }

  static async updateUser(userId, updates) {
    const setClause = Object.keys(updates).map((key, index) => 
      `${key} = $${index + 2}`
    ).join(', ');
    
    const values = [userId, ...Object.values(updates)];
    
    const result = await pool.query(`
      UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING *
    `, values);
    return result.rows[0];
  }

  // Batch operations
  static async createBatch(batchData) {
    const {
      cageId, species, larvalCount, lifecycleStage, hostPlant,
      startDate, phoneNumber, notes, createdBy
    } = batchData;
    
    const result = await pool.query(`
      INSERT INTO batches (cage_id, species, larval_count, lifecycle_stage, host_plant,
                          start_date, phone_number, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [cageId, species, larvalCount, lifecycleStage, hostPlant,
        startDate, phoneNumber, notes, createdBy]);
    return result.rows[0];
  }

  static async getAllBatches() {
    const result = await pool.query(`
      SELECT b.*, u.username as creator_username
      FROM batches b
      LEFT JOIN users u ON b.created_by = u.id
      ORDER BY b.created_at DESC
    `);
    return result.rows;
  }

  static async getBatchByCageId(cageId) {
    const result = await pool.query(`
      SELECT b.*, u.username as creator_username
      FROM batches b
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.cage_id = $1
    `, [cageId]);
    return result.rows[0];
  }

  static async updateBatch(cageId, updates) {
    const setClause = Object.keys(updates).map((key, index) => 
      `${key} = $${index + 2}`
    ).join(', ');
    
    const values = [cageId, ...Object.values(updates)];
    
    const result = await pool.query(`
      UPDATE batches SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE cage_id = $1 RETURNING *
    `, values);
    return result.rows[0];
  }

  static async deleteBatch(cageId) {
    const result = await pool.query(`
      DELETE FROM batches WHERE cage_id = $1 RETURNING *
    `, [cageId]);
    return result.rows[0];
  }

  // Breeding log operations
  static async addBreedingLog(logData) {
    const { cageId, activity, lifecycleStage, userId } = logData;
    const result = await pool.query(`
      INSERT INTO breeding_log (cage_id, activity, lifecycle_stage, user_id)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [cageId, activity, lifecycleStage, userId || null]); // Handle null userId properly
    return result.rows[0];
  }

  static async getBreedingLog(limit = 100) {
    const result = await pool.query(`
      SELECT bl.*, u.username
      FROM breeding_log bl
      LEFT JOIN users u ON bl.user_id = u.id
      ORDER BY bl.timestamp DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  }

  // Order operations
  static async createOrder(orderData) {
    const {
      orderId, buyerId, sellerId, batchId, lifecycleStage,
      species, quantity, pricePerUnit, totalAmount
    } = orderData;
    
    const result = await pool.query(`
      INSERT INTO orders (order_id, buyer_id, seller_id, batch_id, lifecycle_stage,
                         species, quantity, price_per_unit, total_amount)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `, [orderId, buyerId, sellerId, batchId, lifecycleStage,
        species, quantity, pricePerUnit, totalAmount]);
    return result.rows[0];
  }

  static async getOrderById(orderId) {
    const result = await pool.query(`
      SELECT o.*, 
             buyer.username as buyer_username,
             seller.username as seller_username
      FROM orders o
      LEFT JOIN users buyer ON o.buyer_id = buyer.id
      LEFT JOIN users seller ON o.seller_id = seller.id
      WHERE o.order_id = $1
    `, [orderId]);
    return result.rows[0];
  }

  static async getUserOrders(userId, role = 'buyer') {
    const column = role === 'buyer' ? 'buyer_id' : 'seller_id';
    const result = await pool.query(`
      SELECT o.*, 
             buyer.username as buyer_username,
             seller.username as seller_username
      FROM orders o
      LEFT JOIN users buyer ON o.buyer_id = buyer.id
      LEFT JOIN users seller ON o.seller_id = seller.id
      WHERE o.${column} = $1
      ORDER BY o.order_date DESC
    `, [userId]);
    return result.rows;
  }

  // Payment operations
  static async createPayment(paymentData) {
    const { paymentId, orderId, payerId, amount, paymentMethod, referenceNumber } = paymentData;
    const result = await pool.query(`
      INSERT INTO payments (payment_id, order_id, payer_id, amount, payment_method, reference_number)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [paymentId, orderId, payerId, amount, paymentMethod, referenceNumber]);
    return result.rows[0];
  }

  static async updatePaymentStatus(paymentId, status, completedDate = null) {
    const result = await pool.query(`
      UPDATE payments 
      SET status = $2, completed_date = $3
      WHERE payment_id = $1 RETURNING *
    `, [paymentId, status, completedDate]);
    return result.rows[0];
  }

  // CRITICAL: Marketplace sales history operations (PRESERVE DATA)
  static async addPupaeSale(saleData) {
    const {
      batchId, species, larvalCount, qualityScore, hostPlant,
      finalSalePrice, sellerId, sellerName, sellerUsername, sellerRole, salesHistory
    } = saleData;
    
    const result = await pool.query(`
      INSERT INTO pupae_sales (batch_id, species, larval_count, quality_score, host_plant,
                             final_sale_price, seller_id, seller_name, seller_username,
                             seller_role, sales_history, sold_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      RETURNING *
    `, [batchId, species, larvalCount, qualityScore, hostPlant,
        finalSalePrice, sellerId, sellerName, sellerUsername, sellerRole,
        JSON.stringify(salesHistory || [])]);
    return result.rows[0];
  }

  static async getPupaeSalesHistory() {
    const result = await pool.query(`
      SELECT * FROM pupae_sales ORDER BY sold_at DESC
    `);
    return result.rows.map(row => ({
      ...row,
      salesHistory: typeof row.sales_history === 'string' ? JSON.parse(row.sales_history) : row.sales_history,
      sellerInfo: {
        id: row.seller_id,
        name: row.seller_name,
        username: row.seller_username,
        role: row.seller_role
      }
    }));
  }

  static async addLarvaSale(saleData) {
    const {
      batchId, species, larvalCount, qualityScore, hostPlant,
      finalSalePrice, sellerId, sellerName, sellerUsername, sellerRole, salesHistory
    } = saleData;
    
    const result = await pool.query(`
      INSERT INTO larva_sales (batch_id, species, larval_count, quality_score, host_plant,
                             final_sale_price, seller_id, seller_name, seller_username,
                             seller_role, sales_history, sold_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      RETURNING *
    `, [batchId, species, larvalCount, qualityScore, hostPlant,
        finalSalePrice, sellerId, sellerName, sellerUsername, sellerRole,
        JSON.stringify(salesHistory || [])]);
    return result.rows[0];
  }

  static async getLarvaSalesHistory() {
    const result = await pool.query(`
      SELECT * FROM larva_sales ORDER BY sold_at DESC
    `);
    return result.rows.map(row => ({
      ...row,
      salesHistory: typeof row.sales_history === 'string' ? JSON.parse(row.sales_history) : row.sales_history,
      sellerInfo: {
        id: row.seller_id,
        name: row.seller_name,
        username: row.seller_username,
        role: row.seller_role
      }
    }));
  }

  static async addEggSale(saleData) {
    const {
      batchId, species, larvalCount, qualityScore, hostPlant,
      finalSalePrice, sellerId, sellerName, sellerUsername, sellerRole, salesHistory
    } = saleData;
    
    const result = await pool.query(`
      INSERT INTO egg_sales (batch_id, species, larval_count, quality_score, host_plant,
                           final_sale_price, seller_id, seller_name, seller_username,
                           seller_role, sales_history, sold_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      RETURNING *
    `, [batchId, species, larvalCount, qualityScore, hostPlant,
        finalSalePrice, sellerId, sellerName, sellerUsername, sellerRole,
        JSON.stringify(salesHistory || [])]);
    return result.rows[0];
  }

  static async getEggSalesHistory() {
    const result = await pool.query(`
      SELECT * FROM egg_sales ORDER BY sold_at DESC
    `);
    return result.rows.map(row => ({
      ...row,
      salesHistory: typeof row.sales_history === 'string' ? JSON.parse(row.sales_history) : row.sales_history,
      sellerInfo: {
        id: row.seller_id,
        name: row.seller_name,
        username: row.seller_username,
        role: row.seller_role
      }
    }));
  }

  static async addButterflySale(saleData) {
    const {
      batchId, species, larvalCount, qualityScore, hostPlant,
      finalSalePrice, sellerId, sellerName, sellerUsername, sellerRole, salesHistory
    } = saleData;
    
    const result = await pool.query(`
      INSERT INTO butterfly_sales (batch_id, species, larval_count, quality_score, host_plant,
                                 final_sale_price, seller_id, seller_name, seller_username,
                                 seller_role, sales_history, sold_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      RETURNING *
    `, [batchId, species, larvalCount, qualityScore, hostPlant,
        finalSalePrice, sellerId, sellerName, sellerUsername, sellerRole,
        JSON.stringify(salesHistory || [])]);
    return result.rows[0];
  }

  static async getButterflySalesHistory() {
    const result = await pool.query(`
      SELECT * FROM butterfly_sales ORDER BY sold_at DESC
    `);
    return result.rows.map(row => ({
      ...row,
      salesHistory: typeof row.sales_history === 'string' ? JSON.parse(row.sales_history) : row.sales_history,
      sellerInfo: {
        id: row.seller_id,
        name: row.seller_name,
        username: row.seller_username,
        role: row.seller_role
      }
    }));
  }

  // Task operations
  static async createTask(taskData) {
    const {
      title, description, taskType, priority, createdBy,
      assignedTo, cageId, dueDate
    } = taskData;
    
    const result = await pool.query(`
      INSERT INTO tasks (title, description, task_type, priority, created_by,
                        assigned_to, cage_id, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [title, description, taskType, priority, createdBy,
        assignedTo, cageId, dueDate]);
    return result.rows[0];
  }

  static async getUserTasks(userId) {
    const result = await pool.query(`
      SELECT t.*, creator.username as creator_username
      FROM tasks t
      LEFT JOIN users creator ON t.created_by = creator.id
      WHERE t.assigned_to = $1
      ORDER BY t.created_at DESC
    `, [userId]);
    return result.rows;
  }

  static async updateTaskStatus(taskId, status, completedAt = null) {
    const result = await pool.query(`
      UPDATE tasks 
      SET status = $2, completed_at = $3
      WHERE id = $1 RETURNING *
    `, [taskId, status, completedAt]);
    return result.rows[0];
  }

  // User progress and achievements
  static async getUserProgress(userId) {
    const result = await pool.query(`
      SELECT * FROM user_progress WHERE user_id = $1
    `, [userId]);
    return result.rows[0];
  }

  static async updateUserProgress(userId, progressData) {
    const { level, totalPoints, stats } = progressData;
    const result = await pool.query(`
      INSERT INTO user_progress (user_id, level, total_points, stats)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id) DO UPDATE SET
      level = EXCLUDED.level,
      total_points = EXCLUDED.total_points,
      stats = EXCLUDED.stats,
      updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [userId, level, totalPoints, JSON.stringify(stats)]);
    return result.rows[0];
  }

  static async addUserAchievement(userId, achievementId, progressData = {}) {
    const result = await pool.query(`
      INSERT INTO user_achievements (user_id, achievement_id, progress_data)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, achievement_id) DO NOTHING
      RETURNING *
    `, [userId, achievementId, JSON.stringify(progressData)]);
    return result.rows[0];
  }

  static async getUserAchievements(userId) {
    const result = await pool.query(`
      SELECT * FROM user_achievements WHERE user_id = $1
      ORDER BY unlocked_at DESC
    `, [userId]);
    return result.rows.map(row => ({
      ...row,
      progressData: typeof row.progress_data === 'string' ? JSON.parse(row.progress_data) : row.progress_data
    }));
  }

  // Utility functions
  static async query(text, params) {
    return pool.query(text, params);
  }

  static async getClient() {
    return pool.connect();
  }

  static async close() {
    return pool.end();
  }
}

module.exports = Database;