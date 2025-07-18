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
    initializeSocket();
    await loadInitialData();
    setupEventListeners();
    showNotification('Welcome to Butterfly Breeding System!', 'success');
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
        });
        
        socket.on('notification', (data) => {
            showNotification(data.message, data.type);
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

// Placeholder functions for data loading
async function loadBatches() { console.log('Loading batches...'); }
async function loadSpeciesData() { console.log('Loading species data...'); }
async function loadMarketplace() { console.log('Loading marketplace...'); }
async function loadTasks() { console.log('Loading tasks...'); }
async function loadAchievements() { console.log('Loading achievements...'); }
async function loadAnalytics() { console.log('Loading analytics...'); }
async function loadBreedingLog() { console.log('Loading breeding log...'); }