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
        // Load marketplace items and species data
        const [marketplaceResponse, speciesResponse] = await Promise.all([
            makeAuthenticatedRequest('/api/marketplace'),
            makeAuthenticatedRequest('/api/marketplace/species')
        ]);
        
        if (marketplaceResponse && marketplaceResponse.ok) {
            const marketplace = await marketplaceResponse.json();
            let speciesData = [];
            
            if (speciesResponse && speciesResponse.ok) {
                speciesData = await speciesResponse.json();
            }
            
            displayMarketplace(marketplace, speciesData);
        }
    } catch (error) {
        console.error('Error loading marketplace:', error);
        showNotification('Failed to load marketplace data', 'danger');
    }
}

async function loadTasks() { 
    if (currentUser && currentUser.role === 'purchaser') {
        console.log('Tasks not available for purchaser role');
        return;
    }
    console.log('Loading tasks...'); 
    try {
        const response = await makeAuthenticatedRequest('/api/tasks');
        if (response && response.ok) {
            const tasks = await response.json();
            displayTasks(tasks);
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
        showNotification('Failed to load tasks', 'danger');
    }
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

function displayMarketplace(marketplace, speciesData = []) {
    console.log('Displaying marketplace with', marketplace.length, 'items');
    
    const marketplaceContainer = document.getElementById('marketplace');
    if (!marketplaceContainer) return;
    
    let html = `
        <div class="card">
            <h3><i class="fas fa-store"></i> Butterfly Marketplace</h3>
            <p style="color: #666; margin-bottom: 20px;">Browse and purchase high-quality pupae from verified breeders</p>
            
            <!-- Species Filter -->
            <div style="background: #f7fafc; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 10px; font-weight: bold;">Filter by Species:</label>
                <select id="species-filter" onchange="filterMarketplace()" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <option value="">All Species (${marketplace.length} listings)</option>
                    ${speciesData.map(species => `
                        <option value="${species.species}">
                            ${species.species} - ${species.sellers.length} seller(s), ${species.totalAvailable} available
                        </option>
                    `).join('')}
                </select>
            </div>
        </div>
    `;
    
    // Species Overview Cards
    if (speciesData.length > 0) {
        html += `
            <div class="card">
                <h3><i class="fas fa-butterfly"></i> Available Species</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px;">
                    ${speciesData.map(species => `
                        <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 15px; padding: 20px;">
                            <h4 style="margin-bottom: 10px;">${species.species}</h4>
                            <p style="font-style: italic; opacity: 0.9; margin-bottom: 15px;">${species.scientificName}</p>
                            <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 15px;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                                    <div><strong>Available:</strong> ${species.totalAvailable}</div>
                                    <div><strong>Avg Price:</strong> ₱${species.avgPrice.toFixed(2)}</div>
                                    <div><strong>Sellers:</strong> ${species.sellers.length}</div>
                                    <div><strong>Care Level:</strong> ${species.careLevel}</div>
                                </div>
                                <div style="margin-bottom: 10px;"><strong>Host Plants:</strong> ${species.hostPlants.join(', ')}</div>
                                <button onclick="showSpeciesSellers('${species.species}')" style="width: 100%; padding: 8px; background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); border-radius: 6px; cursor: pointer;">
                                    View ${species.sellers.length} Seller(s)
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Individual Listings
    if (marketplace.length > 0) {
        html += `
            <div class="card">
                <h3><i class="fas fa-shopping-cart"></i> Individual Listings</h3>
                <div id="marketplace-listings" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">
                    ${marketplace.map(item => `
                        <div class="marketplace-item" data-species="${item.species}" style="background: white; border: 1px solid #e2e8f0; border-radius: 15px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                                <div>
                                    <h4 style="color: #4a5568; margin-bottom: 5px;">${item.species}</h4>
                                    <p style="color: #666; font-style: italic; font-size: 0.9rem;">${item.scientificName}</p>
                                </div>
                                <div style="text-align: right;">
                                    <div style="background: #667eea; color: white; padding: 5px 10px; border-radius: 20px; font-weight: bold;">
                                        ₱${item.price.toFixed(2)}
                                    </div>
                                    <div style="font-size: 0.8rem; color: #666; margin-top: 2px;">per pupae</div>
                                </div>
                            </div>
                            
                            <div style="background: #f7fafc; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                                    <div><strong>Quantity:</strong> ${item.count}</div>
                                    <div><strong>Quality:</strong> ${(item.qualityScore * 100).toFixed(0)}%</div>
                                    <div><strong>Stage:</strong> ${item.lifecycleStage}</div>
                                    <div><strong>Care Level:</strong> ${item.careLevel}</div>
                                </div>
                                <div style="margin-bottom: 10px;"><strong>Emergence:</strong> ${item.emergenceTime}</div>
                                <div><strong>Host Plants:</strong> ${item.hostPlants.join(', ')}</div>
                            </div>
                            
                            <div style="background: #e6fffa; border: 1px solid #38a169; border-radius: 10px; padding: 15px; margin-bottom: 15px;">
                                <h5 style="color: #38a169; margin-bottom: 10px;"><i class="fas fa-user"></i> Seller Information</h5>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.9rem;">
                                    <div><strong>Name:</strong> ${item.sellerContact.name}</div>
                                    <div><strong>Rating:</strong> ⭐ ${item.sellerContact.rating.toFixed(1)}</div>
                                    <div><strong>Phone:</strong> ${item.sellerPhone || 'Not provided'}</div>
                                    <div><strong>Joined:</strong> ${item.sellerContact.joinDate}</div>
                                </div>
                                ${item.sellerContact.email ? `<div style="margin-top: 8px;"><strong>Email:</strong> ${item.sellerContact.email}</div>` : ''}
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <button onclick="contactSeller('${item.sellerId}', '${item.species}')" style="padding: 10px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                                    <i class="fas fa-phone"></i> Contact Seller
                                </button>
                                <button onclick="purchaseItem('${item.id}', '${item.species}', ${item.price})" style="padding: 10px; background: #38a169; color: white; border: none; border-radius: 8px; cursor: pointer;">
                                    <i class="fas fa-shopping-cart"></i> Purchase
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="card" style="text-align: center; padding: 40px;">
                <i class="fas fa-store" style="font-size: 3rem; color: #cbd5e0; margin-bottom: 20px;"></i>
                <h3 style="color: #4a5568;">No items available</h3>
                <p style="color: #666;">Check back later for new pupae listings from breeders.</p>
            </div>
        `;
    }
    
    marketplaceContainer.innerHTML = html;
    
    // Store data globally for filtering
    window.marketplaceData = marketplace;
    window.speciesData = speciesData;
}

// Marketplace interaction functions
function filterMarketplace() {
    const selectedSpecies = document.getElementById('species-filter').value;
    const listings = document.querySelectorAll('.marketplace-item');
    
    listings.forEach(listing => {
        const itemSpecies = listing.getAttribute('data-species');
        if (!selectedSpecies || itemSpecies === selectedSpecies) {
            listing.style.display = 'block';
        } else {
            listing.style.display = 'none';
        }
    });
}

function showSpeciesSellers(species) {
    const speciesInfo = window.speciesData.find(s => s.species === species);
    if (!speciesInfo) return;
    
    let html = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;" onclick="closeModal()">
            <div style="background: white; border-radius: 15px; padding: 30px; max-width: 800px; max-height: 80vh; overflow-y: auto; width: 90%;" onclick="event.stopPropagation()">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3><i class="fas fa-butterfly"></i> ${species} Sellers</h3>
                    <button onclick="closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">×</button>
                </div>
                
                <div style="background: #f7fafc; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                    <p><strong>Scientific Name:</strong> ${speciesInfo.scientificName}</p>
                    <p><strong>Total Available:</strong> ${speciesInfo.totalAvailable} pupae</p>
                    <p><strong>Average Price:</strong> ₱${speciesInfo.avgPrice.toFixed(2)} per pupae</p>
                    <p><strong>Host Plants:</strong> ${speciesInfo.hostPlants.join(', ')}</p>
                </div>
                
                <div style="display: grid; gap: 15px;">
                    ${speciesInfo.sellers.map(seller => `
                        <div style="background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                                <div>
                                    <h4 style="margin: 0 0 5px 0; color: #4a5568;">${seller.name}</h4>
                                    <p style="margin: 0; color: #666; font-size: 0.9rem;">⭐ ${seller.rating.toFixed(1)} rating • Joined ${seller.joinDate}</p>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 1.2rem; font-weight: bold; color: #667eea;">₱${seller.pricePerPupae.toFixed(2)}</div>
                                    <div style="font-size: 0.8rem; color: #666;">per pupae</div>
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                <div><strong>Available:</strong> ${seller.availableCount}</div>
                                <div><strong>Quality:</strong> ${(seller.qualityScore * 100).toFixed(0)}%</div>
                                <div><strong>Location:</strong> ${seller.location}</div>
                            </div>
                            
                            <div style="margin-bottom: 15px;">
                                <div><strong>Contact:</strong></div>
                                <div style="font-size: 0.9rem; color: #666;">
                                    ${seller.email ? `📧 ${seller.email}<br>` : ''}
                                    ${seller.phone ? `📞 ${seller.phone}<br>` : ''}
                                    📅 Last active: ${seller.lastActive}
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <button onclick="contactSeller('${seller.id}', '${species}')" style="padding: 10px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                                    <i class="fas fa-phone"></i> Contact
                                </button>
                                <button onclick="purchaseFromSeller('${seller.id}', '${species}', ${seller.pricePerPupae})" style="padding: 10px; background: #38a169; color: white; border: none; border-radius: 8px; cursor: pointer;">
                                    <i class="fas fa-shopping-cart"></i> Purchase
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
}

function closeModal() {
    const modals = document.querySelectorAll('div[style*="position: fixed"]');
    modals.forEach(modal => modal.remove());
}

function contactSeller(sellerId, species) {
    showNotification(`Contact feature will open seller's contact information for ${species}`, 'info');
    // Implementation for contact functionality
}

function purchaseItem(itemId, species, price) {
    showNotification(`Purchase functionality for ${species} (₱${price}) will be implemented`, 'info');
    // Implementation for purchase functionality
}

function purchaseFromSeller(sellerId, species, price) {
    showNotification(`Purchase from seller for ${species} (₱${price.toFixed(2)}) will be implemented`, 'info');
    closeModal();
}

// Task Management Functions
function displayTasks(tasks) {
    const tasksContainer = document.getElementById('tasks');
    if (!tasksContainer) return;
    
    // Group tasks by status
    const tasksByStatus = {
        pending: tasks.filter(t => t.status === 'pending'),
        in_progress: tasks.filter(t => t.status === 'in_progress'),
        overdue: tasks.filter(t => t.status === 'overdue'),
        completed: tasks.filter(t => t.status === 'completed')
    };
    
    let html = `
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3><i class="fas fa-tasks"></i> Task Management</h3>
                <button onclick="showCreateTaskModal()" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    <i class="fas fa-plus"></i> New Task
                </button>
            </div>
            
            <!-- Task Stats -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px;">
                <div style="background: linear-gradient(135deg, #f6ad55, #ed8936); color: white; padding: 20px; border-radius: 10px; text-align: center;">
                    <h4 style="font-size: 2rem; margin: 0;">${tasksByStatus.pending.length}</h4>
                    <p style="margin: 5px 0 0 0; opacity: 0.9;">Pending Tasks</p>
                </div>
                <div style="background: linear-gradient(135deg, #4299e1, #3182ce); color: white; padding: 20px; border-radius: 10px; text-align: center;">
                    <h4 style="font-size: 2rem; margin: 0;">${tasksByStatus.in_progress.length}</h4>
                    <p style="margin: 5px 0 0 0; opacity: 0.9;">In Progress</p>
                </div>
                <div style="background: linear-gradient(135deg, #e53e3e, #c53030); color: white; padding: 20px; border-radius: 10px; text-align: center;">
                    <h4 style="font-size: 2rem; margin: 0;">${tasksByStatus.overdue.length}</h4>
                    <p style="margin: 5px 0 0 0; opacity: 0.9;">Overdue</p>
                </div>
                <div style="background: linear-gradient(135deg, #38a169, #2f855a); color: white; padding: 20px; border-radius: 10px; text-align: center;">
                    <h4 style="font-size: 2rem; margin: 0;">${tasksByStatus.completed.length}</h4>
                    <p style="margin: 5px 0 0 0; opacity: 0.9;">Completed</p>
                </div>
            </div>
            
            <!-- Task Filters -->
            <div style="background: #f7fafc; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <select id="status-filter" onchange="filterTasks()" style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="overdue">Overdue</option>
                        <option value="completed">Completed</option>
                    </select>
                    <select id="priority-filter" onchange="filterTasks()" style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">
                        <option value="">All Priorities</option>
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                    <select id="type-filter" onchange="filterTasks()" style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">
                        <option value="">All Types</option>
                        <option value="feeding">Feeding</option>
                        <option value="monitoring">Monitoring</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="breeding">Breeding</option>
                        <option value="harvest">Harvest</option>
                    </select>
                </div>
            </div>
        </div>
    `;
    
    // Task Lists by Status
    ['overdue', 'pending', 'in_progress', 'completed'].forEach(status => {
        const statusTasks = tasksByStatus[status];
        const statusColors = {
            overdue: '#e53e3e',
            pending: '#f6ad55', 
            in_progress: '#4299e1',
            completed: '#38a169'
        };
        
        html += `
            <div class="card">
                <h3 style="color: ${statusColors[status]}; text-transform: capitalize;">
                    <i class="fas fa-${status === 'overdue' ? 'exclamation-triangle' : status === 'pending' ? 'clock' : status === 'in_progress' ? 'spinner' : 'check-circle'}"></i>
                    ${status.replace('_', ' ')} Tasks (${statusTasks.length})
                </h3>
                <div id="tasks-${status}" style="display: grid; gap: 15px;">
                    ${statusTasks.map(task => `
                        <div class="task-item" data-status="${task.status}" data-priority="${task.priority}" data-type="${task.task_type}" 
                             style="background: white; border: 1px solid #e2e8f0; border-left: 4px solid ${statusColors[status]}; border-radius: 10px; padding: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                                <div style="flex: 1;">
                                    <h4 style="margin: 0 0 5px 0; color: #4a5568;">${task.title}</h4>
                                    <p style="margin: 0 0 10px 0; color: #666; font-size: 0.9rem;">${task.description || 'No description'}</p>
                                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                        <span style="background: ${getPriorityColor(task.priority)}; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.8rem; text-transform: uppercase;">
                                            ${task.priority}
                                        </span>
                                        <span style="background: #e2e8f0; color: #4a5568; padding: 3px 8px; border-radius: 12px; font-size: 0.8rem;">
                                            ${task.task_type}
                                        </span>
                                        ${task.species ? `<span style="background: #667eea; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.8rem;">${task.species}</span>` : ''}
                                        ${task.cage_id ? `<span style="background: #38a169; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.8rem;">${task.cage_id}</span>` : ''}
                                    </div>
                                </div>
                                <div style="display: flex; gap: 5px;">
                                    <button onclick="editTask(${task.id})" style="padding: 5px 10px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="deleteTask(${task.id})" style="padding: 5px 10px; background: #e53e3e; color: white; border: none; border-radius: 5px; cursor: pointer;">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; font-size: 0.9rem; color: #666;">
                                <div><strong>Due:</strong> ${task.due_date ? new Date(task.due_date).toLocaleString() : 'No due date'}</div>
                                <div><strong>Assigned:</strong> ${task.assigned_username || 'Unassigned'}</div>
                                ${task.recurring ? `<div><strong>Recurring:</strong> ${task.recurrence_pattern}</div>` : ''}
                                ${task.completed_at ? `<div><strong>Completed:</strong> ${new Date(task.completed_at).toLocaleString()}</div>` : ''}
                            </div>
                            
                            ${task.status !== 'completed' ? `
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px;">
                                    ${task.status === 'pending' ? `<button onclick="updateTaskStatus(${task.id}, 'in_progress')" style="padding: 8px; background: #4299e1; color: white; border: none; border-radius: 5px; cursor: pointer;">Start Task</button>` : ''}
                                    ${task.status === 'in_progress' ? `<button onclick="updateTaskStatus(${task.id}, 'completed')" style="padding: 8px; background: #38a169; color: white; border: none; border-radius: 5px; cursor: pointer;">Complete</button>` : ''}
                                    ${task.status === 'overdue' ? `<button onclick="updateTaskStatus(${task.id}, 'in_progress')" style="padding: 8px; background: #4299e1; color: white; border: none; border-radius: 5px; cursor: pointer;">Resume</button>` : ''}
                                </div>
                            ` : ''}
                            
                            ${task.notes ? `<div style="background: #f7fafc; padding: 10px; border-radius: 5px; margin-top: 10px; font-size: 0.9rem;"><strong>Notes:</strong> ${task.notes}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
    
    tasksContainer.innerHTML = html;
    
    // Store tasks globally for filtering
    window.tasksData = tasks;
}

function getPriorityColor(priority) {
    const colors = {
        urgent: '#e53e3e',
        high: '#ed8936',
        medium: '#4299e1',
        low: '#38a169'
    };
    return colors[priority] || '#4299e1';
}

function filterTasks() {
    const statusFilter = document.getElementById('status-filter').value;
    const priorityFilter = document.getElementById('priority-filter').value;
    const typeFilter = document.getElementById('type-filter').value;
    
    const taskItems = document.querySelectorAll('.task-item');
    
    taskItems.forEach(item => {
        const status = item.getAttribute('data-status');
        const priority = item.getAttribute('data-priority');
        const type = item.getAttribute('data-type');
        
        const statusMatch = !statusFilter || status === statusFilter;
        const priorityMatch = !priorityFilter || priority === priorityFilter;
        const typeMatch = !typeFilter || type === typeFilter;
        
        if (statusMatch && priorityMatch && typeMatch) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

async function updateTaskStatus(taskId, newStatus) {
    try {
        const response = await makeAuthenticatedRequest(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response && response.ok) {
            showNotification(`Task ${newStatus.replace('_', ' ')}!`, 'success');
            loadTasks(); // Reload tasks
        } else {
            showNotification('Failed to update task', 'danger');
        }
    } catch (error) {
        console.error('Error updating task:', error);
        showNotification('Error updating task', 'danger');
    }
}

function showCreateTaskModal() {
    // Implementation for create task modal
    showNotification('Create task modal will be implemented', 'info');
}

function editTask(taskId) {
    // Implementation for edit task
    showNotification(`Edit task ${taskId} will be implemented`, 'info');
}

async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
        const response = await makeAuthenticatedRequest(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        if (response && response.ok) {
            showNotification('Task deleted successfully', 'success');
            loadTasks(); // Reload tasks
        } else {
            showNotification('Failed to delete task', 'danger');
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        showNotification('Error deleting task', 'danger');
    }
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