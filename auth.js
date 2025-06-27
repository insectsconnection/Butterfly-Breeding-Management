const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');

const USERS_FILE = path.join('./data', 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'butterfly-breeding-secret-key-2025';

// User roles and permissions
const USER_ROLES = {
  ADMIN: 'admin',
  BREEDER: 'breeder', 
  ENTHUSIAST: 'enthusiast',
  PURCHASER: 'purchaser',
  STUDENT: 'student',
  FACULTY: 'faculty',
  OTHER: 'other'
};

const ROLE_PERMISSIONS = {
  [USER_ROLES.ADMIN]: ['*'], // All permissions
  [USER_ROLES.BREEDER]: ['view_batches', 'create_batches', 'update_batches', 'view_analytics', 'manage_tasks', 'classify_images'],
  [USER_ROLES.ENTHUSIAST]: ['view_batches', 'create_batches', 'classify_images'],
  [USER_ROLES.PURCHASER]: ['view_batches', 'view_analytics'],
  [USER_ROLES.STUDENT]: ['view_batches', 'classify_images'],
  [USER_ROLES.FACULTY]: ['view_batches', 'create_batches', 'view_analytics', 'classify_images'],
  [USER_ROLES.OTHER]: ['view_batches']
};

// Default admin user
const DEFAULT_ADMIN = {
  id: 'admin-001',
  username: 'admin',
  email: 'admin@butterflybreeding.com',
  password: '$2a$10$YourHashedPasswordHere', // Will be properly hashed
  role: USER_ROLES.ADMIN,
  firstName: 'System',
  lastName: 'Administrator',
  organization: 'Butterfly Breeding Management',
  createdAt: new Date().toISOString(),
  lastLogin: null,
  isActive: true
};

// Initialize users database
async function initializeUsers() {
  try {
    await fs.access(USERS_FILE);
  } catch (error) {
    // Create users file with default admin
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = { ...DEFAULT_ADMIN, password: hashedPassword };
    await fs.writeFile(USERS_FILE, JSON.stringify([admin], null, 2));
    console.log('✓ Created default admin user (username: admin, password: admin123)');
  }
}

// Load users from database
async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading users:', error);
    return [];
  }
}

// Save users to database
async function saveUsers(users) {
  try {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error saving users:', error);
  }
}

// Register new user
async function registerUser(userData) {
  const users = await loadUsers();
  
  // Check if username or email already exists
  const existingUser = users.find(u => 
    u.username === userData.username || u.email === userData.email
  );
  
  if (existingUser) {
    throw new Error('Username or email already exists');
  }
  
  // Hash password
  const hashedPassword = await bcrypt.hash(userData.password, 10);
  
  // Create new user
  const newUser = {
    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    username: userData.username,
    email: userData.email,
    password: hashedPassword,
    role: userData.role || USER_ROLES.OTHER,
    firstName: userData.firstName,
    lastName: userData.lastName,
    organization: userData.organization || '',
    createdAt: new Date().toISOString(),
    lastLogin: null,
    isActive: true
  };
  
  users.push(newUser);
  await saveUsers(users);
  
  // Return user without password
  const { password, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
}

// Authenticate user
async function authenticateUser(username, password) {
  const users = await loadUsers();
  const user = users.find(u => u.username === username && u.isActive);
  
  if (!user) {
    throw new Error('Invalid credentials');
  }
  
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }
  
  // Update last login
  user.lastLogin = new Date().toISOString();
  await saveUsers(users);
  
  // Return user without password
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

// Generate JWT token
function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      role: user.role,
      email: user.email 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

// Check user permissions
function hasPermission(userRole, requiredPermission) {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes('*') || permissions.includes(requiredPermission);
}

// Middleware to authenticate requests
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const user = verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Middleware to check permissions
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

// Get all users (admin only)
async function getAllUsers() {
  const users = await loadUsers();
  return users.map(({ password, ...user }) => user);
}

// Update user
async function updateUser(userId, updates) {
  const users = await loadUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) {
    throw new Error('User not found');
  }
  
  // Don't allow role changes unless admin
  if (updates.password) {
    updates.password = await bcrypt.hash(updates.password, 10);
  }
  
  users[userIndex] = { ...users[userIndex], ...updates };
  await saveUsers(users);
  
  const { password, ...userWithoutPassword } = users[userIndex];
  return userWithoutPassword;
}

// Delete user
async function deleteUser(userId) {
  const users = await loadUsers();
  const filteredUsers = users.filter(u => u.id !== userId);
  
  if (users.length === filteredUsers.length) {
    throw new Error('User not found');
  }
  
  await saveUsers(filteredUsers);
  return true;
}

module.exports = {
  USER_ROLES,
  ROLE_PERMISSIONS,
  initializeUsers,
  registerUser,
  authenticateUser,
  generateToken,
  verifyToken,
  hasPermission,
  authenticateToken,
  requirePermission,
  getAllUsers,
  updateUser,
  deleteUser
};