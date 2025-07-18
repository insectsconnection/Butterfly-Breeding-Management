// Global variables
let socket;
let batches = [];
let breedingLog = [];
let currentBatch = null;
let currentUser = null;
let authToken = null;
let tasks = [];
let speciesData = [];

// Tab navigation function - make it available immediately
function showTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab content
    const targetTab = document.getElementById(tabName);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // Add active class to clicked nav tab
    const clickedTab = Array.from(document.querySelectorAll('.nav-tab')).find(tab => 
        tab.getAttribute('onclick') && tab.getAttribute('onclick').includes(tabName)
    );
    if (clickedTab) {
        clickedTab.classList.add('active');
    }
    
    // Load data for specific tabs if authenticated
    if (authToken) {
        if (tabName === 'batches') {
            loadBatches();
            loadSpeciesData();
        } else if (tabName === 'marketplace') {
            loadMarketplace();
        } else if (tabName === 'tasks') {
            loadTasks();
        } else if (tabName === 'achievements') {
            loadAchievements();
        } else if (tabName === 'analytics') {
            loadAnalytics();
        } else if (tabName === 'breeding-log') {
            loadBreedingLog();
        }
    }
}

// Profile and logout functions - make them available immediately
function viewProfile(userId = null) {
    console.log('Viewing profile for user:', userId || 'current user');
    // Profile functionality can be implemented here
}

function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    authToken = null;
    currentUser = null;
    if (socket) {
        socket.disconnect();
    }
    window.location.href = '/login.html';
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    initializeApp();
});

async function initializeApp() {
    try {
        await checkAuthentication();
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showNotification('Application initialization failed', 'danger');
    }
}

// Check authentication status
async function checkAuthentication() {
    authToken = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    if (!authToken || !userData) {
        // Try auto-login with default admin credentials
        try {
            console.log('Attempting auto-login...');
            const loginResponse = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: 'admin',
                    password: 'admin123'
                })
            });
            
            if (loginResponse.ok) {
                const loginData = await loginResponse.json();
                localStorage.setItem('auth_token', loginData.token);
                localStorage.setItem('user_data', JSON.stringify(loginData.user));
                authToken = loginData.token;
                currentUser = loginData.user;
                console.log('Auto-login successful');
                await initializeAuthenticatedApp();
                return;
            } else {
                console.log('Auto-login failed, redirecting to login');
            }
        } catch (error) {
            console.error('Auto-login error:', error);
        }
        
        // Redirect to login page if auto-login fails
        window.location.href = '/login.html';
        return;
    }
    
    try {
        currentUser = JSON.parse(userData);
        console.log('Using stored authentication');
        await initializeAuthenticatedApp();
    } catch (error) {
        console.error('Error parsing user data:', error);
        logout();
    }
}

async function initializeAuthenticatedApp() {
    updateUserInterface();
    setupRoleBasedInterface();
    initializeSocket();
    await loadInitialData();
    setupEventListeners();
    
    // Initialize purchaser-specific features
    if (currentUser && currentUser.role === 'purchaser') {
        initializePurchaserClassification();
        showNotification('Welcome to Butterfly Breeding System! Use AI Classification to assess pupae quality.', 'success');
    } else {
        showNotification('Welcome to Butterfly Breeding System!', 'success');
    }
}

function updateUserInterface() {
    if (currentUser) {
        console.log('Updating UI for user:', currentUser.username);
        // Update user display if elements exist
        const userElements = document.querySelectorAll('.user-name');
        userElements.forEach(el => {
            el.textContent = currentUser.username;
        });
    }
}

function initializeSocket() {
    if (typeof io !== 'undefined') {
        socket = io();
        socket.on('connect', () => {
            console.log('Socket.IO connected');
            showNotification('🔗 Connected to server - AI Classification ready!', 'success');
        });
        
        socket.on('disconnect', () => {
            console.log('Socket.IO disconnected');
            showNotification('⚠️ Disconnected from server - Reconnecting...', 'warning');
        });
        
        socket.on('reconnect', () => {
            console.log('Socket.IO reconnected');
            showNotification('✅ Reconnected to server successfully!', 'success');
        });
        
        socket.on('notification', (data) => {
            showNotification(data.message, data.type);
        });
        
        socket.on('classification_progress', (data) => {
            showNotification(`🔍 ${data.message}`, 'info');
        });
    }
}

async function loadInitialData() {
    try {
        console.log('Loading initial data...');
        // Load dashboard data by default
        await loadDashboard();
    } catch (error) {
        console.error('Error loading initial data:', error);
    }
}

function setupEventListeners() {
    // Set up form event listeners and other interactions
    console.log('Event listeners set up');
}

// Utility functions
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const content = document.getElementById('notification-content');
    
    if (notification && content) {
        content.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 5000);
    } else {
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}

async function makeAuthenticatedRequest(url, options = {}) {
    if (!authToken) {
        throw new Error('No authentication token available');
    }
    
    const defaultHeaders = {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
    };
    
    const requestOptions = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    };
    
    const response = await fetch(url, requestOptions);
    
    if (response.status === 401) {
        logout();
        return null;
    }
    
    return response;
}

// Dashboard loading function
async function loadDashboard() {
    console.log('Loading dashboard...');
    // Basic dashboard loading implementation
}

// Role-based interface setup
function setupRoleBasedInterface() {
    if (!currentUser) return;
    
    const userRole = currentUser.role;
    console.log('Setting up interface for role:', userRole);
    
    // Hide tabs based on role
    if (userRole === 'purchaser') {
        // Hide tabs that purchasers should not see
        hideTabIfExists('batches');
        hideTabIfExists('tasks'); 
        hideTabIfExists('breeding-log');
        hideTabIfExists('achievements');
        hideTabIfExists('settings');
        hideTabIfExists('student-dashboard');
        
        // Hide profile button
        hideElementIfExists('[onclick="viewProfile()"]');
        
        // Show only allowed tabs
        showTabIfExists('classification');
        showTabIfExists('marketplace');
        showTabIfExists('analytics'); // For purchase history
        
        // Default to classification tab for purchasers
        setTimeout(() => {
            showTab('classification');
        }, 500);
    }
}

function hideTabIfExists(tabName) {
    const tab = document.querySelector(`[onclick="showTab('${tabName}')"]`);
    if (tab) {
        tab.style.display = 'none';
    }
}

function showTabIfExists(tabName) {
    const tab = document.querySelector(`[onclick="showTab('${tabName}')"]`);
    if (tab) {
        tab.style.display = 'block';
    }
}

function hideElementIfExists(selector) {
    const element = document.querySelector(selector);
    if (element) {
        element.style.display = 'none';
    }
}

// Enhanced data loading functions
async function loadBatches() { 
    console.log('Loading batches...'); 
    // Will implement full functionality
}

async function loadSpeciesData() { 
    console.log('Loading species data...'); 
    // Will implement full functionality
}

async function loadMarketplace() { 
    console.log('Loading marketplace...'); 
    try {
        const response = await makeAuthenticatedRequest('/api/marketplace');
        if (response && response.ok) {
            const marketplace = await response.json();
            displayMarketplace(marketplace);
        }
    } catch (error) {
        console.error('Error loading marketplace:', error);
    }
}

async function loadTasks() { 
    if (currentUser && currentUser.role === 'purchaser') {
        console.log('Tasks not available for purchaser role');
        return;
    }
    console.log('Loading tasks...'); 
}

async function loadAchievements() { 
    if (currentUser && currentUser.role === 'purchaser') {
        console.log('Achievements not available for purchaser role');
        return;
    }
    console.log('Loading achievements...'); 
}

async function loadAnalytics() { 
    console.log('Loading analytics...'); 
    if (currentUser && currentUser.role === 'purchaser') {
        await loadPurchaseHistory();
    } else {
        // Load regular analytics for other roles
        console.log('Loading breeder analytics...');
    }
}

async function loadBreedingLog() { 
    if (currentUser && currentUser.role === 'purchaser') {
        console.log('Breeding log not available for purchaser role');
        return;
    }
    console.log('Loading breeding log...'); 
}

// Purchase history for purchasers
async function loadPurchaseHistory() {
    try {
        const response = await makeAuthenticatedRequest(`/api/users/${currentUser.id}/purchases`);
        if (response && response.ok) {
            const purchases = await response.json();
            displayPurchaseHistory(purchases);
        }
    } catch (error) {
        console.error('Error loading purchase history:', error);
    }
}

function displayMarketplace(marketplace) {
    console.log('Displaying marketplace with', marketplace.length, 'items');
    // Implementation will be added
}

function displayPurchaseHistory(purchases) {
    console.log('Displaying purchase history with', purchases.length, 'purchases');
    
    const analyticsContainer = document.getElementById('analytics');
    if (!analyticsContainer) return;
    
    // Calculate totals by species
    const speciesStats = {};
    let totalPurchases = 0;
    let totalSpent = 0;
    
    purchases.forEach(purchase => {
        const species = purchase.title.split(' - ')[0]; // Extract species from title
        const quantity = parseInt(purchase.title.split('x')[0].split('- ')[1]) || 1;
        const price = parseFloat(purchase.price) || 0;
        
        if (!speciesStats[species]) {
            speciesStats[species] = { quantity: 0, totalCost: 0, purchases: 0 };
        }
        
        speciesStats[species].quantity += quantity;
        speciesStats[species].totalCost += price;
        speciesStats[species].purchases += 1;
        
        totalPurchases += quantity;
        totalSpent += price;
    });
    
    analyticsContainer.innerHTML = `
        <div class="card">
            <h3><i class="fas fa-shopping-cart"></i> Purchase Summary</h3>
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>${purchases.length}</h4>
                    <p>Total Orders</p>
                </div>
                <div class="stat-card">
                    <h4>${totalPurchases}</h4>
                    <p>Pupae Purchased</p>
                </div>
                <div class="stat-card">
                    <h4>₱${totalSpent.toFixed(2)}</h4>
                    <p>Total Spent</p>
                </div>
                <div class="stat-card">
                    <h4>${Object.keys(speciesStats).length}</h4>
                    <p>Species Varieties</p>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h3><i class="fas fa-chart-pie"></i> Purchases by Species</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                ${Object.entries(speciesStats).map(([species, stats]) => `
                    <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 15px; padding: 20px;">
                        <h4 style="margin-bottom: 15px;">${species}</h4>
                        <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 15px;">
                            <p><strong>Quantity:</strong> ${stats.quantity} pupae</p>
                            <p><strong>Orders:</strong> ${stats.purchases}</p>
                            <p><strong>Total Cost:</strong> ₱${stats.totalCost.toFixed(2)}</p>
                            <p><strong>Avg per Pupae:</strong> ₱${(stats.totalCost / stats.quantity).toFixed(2)}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="card">
            <h3><i class="fas fa-history"></i> Recent Purchase History</h3>
            <div style="max-height: 400px; overflow-y: auto;">
                ${purchases.length === 0 ? 
                    '<p style="text-align: center; color: #666; padding: 40px;">No purchases yet. Visit the marketplace to start buying!</p>' :
                    purchases.map(purchase => `
                        <div style="background: #f7fafc; border-radius: 8px; padding: 15px; margin-bottom: 10px; border-left: 4px solid #667eea;">
                            <div style="display: flex; justify-content: between; align-items: flex-start;">
                                <div style="flex: 1;">
                                    <h5 style="margin: 0 0 5px 0; color: #4a5568;">${purchase.title}</h5>
                                    <p style="margin: 0 0 5px 0; color: #666; font-size: 0.9rem;">${purchase.description}</p>
                                    <div style="display: flex; gap: 15px; font-size: 0.9rem; color: #666;">
                                        <span><i class="fas fa-calendar"></i> ${new Date(purchase.purchaseDate).toLocaleDateString()}</span>
                                        <span><i class="fas fa-user"></i> ${purchase.sellerName}</span>
                                        <span style="color: ${purchase.status === 'completed' ? '#38a169' : '#d69e2e'};">
                                            <i class="fas fa-circle" style="font-size: 0.7rem;"></i> ${purchase.status}
                                        </span>
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 1.2rem; font-weight: bold; color: #667eea;">₱${purchase.price}</div>
                                </div>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        </div>
    `;
}