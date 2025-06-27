const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// Payment status constants
const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
};

// Payment methods
const PAYMENT_METHODS = {
  GCASH: 'gcash',
  CREDIT_CARD: 'credit_card',
  BANK_TRANSFER: 'bank_transfer',
  PAYPAL: 'paypal'
};

// GCash API Configuration
const GCASH_CONFIG = {
  baseURL: process.env.GCASH_API_URL || 'https://api.gcash.com',
  merchantId: process.env.GCASH_MERCHANT_ID,
  secretKey: process.env.GCASH_SECRET_KEY,
  publicKey: process.env.GCASH_PUBLIC_KEY,
  callbackURL: process.env.GCASH_CALLBACK_URL || `${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}/api/payments/gcash/callback`,
  returnURL: process.env.GCASH_RETURN_URL || `${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}/payment-success`,
  cancelURL: process.env.GCASH_CANCEL_URL || `${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}/payment-cancelled`
};

class PaymentProcessor {
  constructor() {
    this.paymentsFile = path.join('./data', 'payments.json');
    this.ordersFile = path.join('./data', 'orders.json');
  }

  // Initialize payment system
  async initialize() {
    try {
      // Create payment data files if they don't exist
      const dataFiles = [this.paymentsFile, this.ordersFile];
      for (const file of dataFiles) {
        try {
          await fs.access(file);
        } catch (error) {
          await fs.writeFile(file, JSON.stringify([], null, 2));
        }
      }
      console.log('✓ Payment system initialized');
      return true;
    } catch (error) {
      console.error('❌ Error initializing payment system:', error);
      return false;
    }
  }

  // Load payments from storage
  async loadPayments() {
    try {
      const data = await fs.readFile(this.paymentsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading payments:', error);
      return [];
    }
  }

  // Save payments to storage
  async savePayments(payments) {
    try {
      await fs.writeFile(this.paymentsFile, JSON.stringify(payments, null, 2));
    } catch (error) {
      console.error('Error saving payments:', error);
    }
  }

  // Load orders from storage
  async loadOrders() {
    try {
      const data = await fs.readFile(this.ordersFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading orders:', error);
      return [];
    }
  }

  // Save orders to storage
  async saveOrders(orders) {
    try {
      await fs.writeFile(this.ordersFile, JSON.stringify(orders, null, 2));
    } catch (error) {
      console.error('Error saving orders:', error);
    }
  }

  // Generate secure payment ID
  generatePaymentId() {
    return 'PAY_' + crypto.randomBytes(16).toString('hex').toUpperCase();
  }

  // Generate order ID
  generateOrderId() {
    return 'ORD_' + Date.now() + '_' + crypto.randomBytes(8).toString('hex').toUpperCase();
  }

  // Create a new order
  async createOrder(orderData) {
    try {
      const orders = await this.loadOrders();
      
      const newOrder = {
        orderId: this.generateOrderId(),
        buyerId: orderData.buyerId,
        buyerEmail: orderData.buyerEmail,
        buyerPhone: orderData.buyerPhone,
        sellerId: orderData.sellerId,
        sellerEmail: orderData.sellerEmail,
        sellerPhone: orderData.sellerPhone,
        items: orderData.items, // Array of butterfly batches
        totalAmount: orderData.totalAmount,
        currency: 'PHP',
        status: 'pending',
        paymentStatus: PAYMENT_STATUS.PENDING,
        shippingAddress: orderData.shippingAddress,
        notes: orderData.notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      orders.push(newOrder);
      await this.saveOrders(orders);
      
      return newOrder;
    } catch (error) {
      console.error('Error creating order:', error);
      throw new Error('Failed to create order');
    }
  }

  // Create GCash payment
  async createGCashPayment(paymentData) {
    try {
      const paymentId = this.generatePaymentId();
      const timestamp = Date.now().toString();
      
      // Prepare payment request data
      const paymentRequest = {
        merchantId: GCASH_CONFIG.merchantId,
        orderId: paymentData.orderId,
        amount: paymentData.amount,
        currency: 'PHP',
        description: paymentData.description || 'Butterfly Purchase',
        customerName: paymentData.customerName,
        customerEmail: paymentData.customerEmail,
        customerPhone: paymentData.customerPhone,
        callbackURL: GCASH_CONFIG.callbackURL,
        returnURL: GCASH_CONFIG.returnURL,
        cancelURL: GCASH_CONFIG.cancelURL,
        timestamp: timestamp
      };

      // Generate signature for security
      const signature = this.generateGCashSignature(paymentRequest);
      paymentRequest.signature = signature;

      // Store payment record
      const payment = {
        paymentId: paymentId,
        orderId: paymentData.orderId,
        buyerId: paymentData.buyerId,
        sellerId: paymentData.sellerId,
        amount: paymentData.amount,
        currency: 'PHP',
        method: PAYMENT_METHODS.GCASH,
        status: PAYMENT_STATUS.PENDING,
        gcashTransactionId: null,
        gcashReferenceNumber: null,
        paymentURL: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
        metadata: {
          customerName: paymentData.customerName,
          customerEmail: paymentData.customerEmail,
          customerPhone: paymentData.customerPhone,
          description: paymentData.description
        }
      };

      // For demo purposes, simulate GCash API response
      // In production, you would make actual API call to GCash
      const gcashResponse = await this.simulateGCashAPI(paymentRequest);
      
      if (gcashResponse.success) {
        payment.gcashTransactionId = gcashResponse.transactionId;
        payment.paymentURL = gcashResponse.paymentURL;
        payment.status = PAYMENT_STATUS.PROCESSING;
      } else {
        payment.status = PAYMENT_STATUS.FAILED;
        throw new Error(gcashResponse.error || 'GCash payment creation failed');
      }

      // Save payment record
      const payments = await this.loadPayments();
      payments.push(payment);
      await this.savePayments(payments);

      return {
        paymentId: payment.paymentId,
        paymentURL: payment.paymentURL,
        transactionId: payment.gcashTransactionId,
        expiresAt: payment.expiresAt,
        status: payment.status
      };

    } catch (error) {
      console.error('Error creating GCash payment:', error);
      throw new Error('Failed to create GCash payment');
    }
  }

  // Generate GCash signature for security
  generateGCashSignature(data) {
    // Create signature string by concatenating key fields
    const signatureString = [
      data.merchantId,
      data.orderId,
      data.amount,
      data.currency,
      data.timestamp,
      GCASH_CONFIG.secretKey
    ].join('|');

    // Generate HMAC SHA256 signature
    return crypto
      .createHmac('sha256', GCASH_CONFIG.secretKey)
      .update(signatureString)
      .digest('hex')
      .toUpperCase();
  }

  // Simulate GCash API response (replace with actual GCash API integration)
  async simulateGCashAPI(paymentRequest) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // In production, replace this with actual GCash API call
    try {
      // Simulate successful response
      const transactionId = 'GC_' + crypto.randomBytes(12).toString('hex').toUpperCase();
      const paymentURL = `https://pay.gcash.com/checkout/${transactionId}`;

      return {
        success: true,
        transactionId: transactionId,
        paymentURL: paymentURL,
        referenceNumber: 'REF_' + Date.now(),
        message: 'Payment URL generated successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: 'GCash API simulation error'
      };
    }
  }

  // Handle GCash callback/webhook
  async handleGCashCallback(callbackData) {
    try {
      const { transactionId, status, orderId, amount, referenceNumber, signature } = callbackData;

      // Verify signature for security
      if (!this.verifyGCashSignature(callbackData)) {
        throw new Error('Invalid signature');
      }

      // Find payment record
      const payments = await this.loadPayments();
      const paymentIndex = payments.findIndex(p => 
        p.gcashTransactionId === transactionId || p.orderId === orderId
      );

      if (paymentIndex === -1) {
        throw new Error('Payment not found');
      }

      const payment = payments[paymentIndex];

      // Update payment status based on GCash callback
      switch (status.toLowerCase()) {
        case 'success':
        case 'completed':
          payment.status = PAYMENT_STATUS.COMPLETED;
          payment.gcashReferenceNumber = referenceNumber;
          await this.completeOrder(payment.orderId);
          break;
        case 'failed':
        case 'error':
          payment.status = PAYMENT_STATUS.FAILED;
          break;
        case 'cancelled':
          payment.status = PAYMENT_STATUS.CANCELLED;
          break;
        default:
          payment.status = PAYMENT_STATUS.PROCESSING;
      }

      payment.updatedAt = new Date().toISOString();
      payments[paymentIndex] = payment;
      await this.savePayments(payments);

      return {
        success: true,
        paymentId: payment.paymentId,
        status: payment.status
      };

    } catch (error) {
      console.error('Error handling GCash callback:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Verify GCash callback signature
  verifyGCashSignature(data) {
    const { signature, ...payloadData } = data;
    const expectedSignature = this.generateGCashSignature(payloadData);
    return signature === expectedSignature;
  }

  // Complete order after successful payment
  async completeOrder(orderId) {
    try {
      const orders = await this.loadOrders();
      const orderIndex = orders.findIndex(o => o.orderId === orderId);

      if (orderIndex !== -1) {
        orders[orderIndex].status = 'completed';
        orders[orderIndex].paymentStatus = PAYMENT_STATUS.COMPLETED;
        orders[orderIndex].updatedAt = new Date().toISOString();
        
        await this.saveOrders(orders);
        
        // Here you could trigger additional actions like:
        // - Send confirmation emails
        // - Update inventory
        // - Trigger shipping process
        // - Send notifications to seller
      }
    } catch (error) {
      console.error('Error completing order:', error);
    }
  }

  // Get payment status
  async getPaymentStatus(paymentId) {
    try {
      const payments = await this.loadPayments();
      const payment = payments.find(p => p.paymentId === paymentId);
      
      if (!payment) {
        throw new Error('Payment not found');
      }

      return {
        paymentId: payment.paymentId,
        orderId: payment.orderId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        gcashReferenceNumber: payment.gcashReferenceNumber
      };
    } catch (error) {
      console.error('Error getting payment status:', error);
      throw new Error('Failed to get payment status');
    }
  }

  // Get user orders
  async getUserOrders(userId, role = 'buyer') {
    try {
      const orders = await this.loadOrders();
      const userOrders = orders.filter(order => {
        if (role === 'buyer') {
          return order.buyerId === userId;
        } else if (role === 'seller') {
          return order.sellerId === userId;
        }
        return false;
      });

      return userOrders;
    } catch (error) {
      console.error('Error getting user orders:', error);
      return [];
    }
  }

  // Cancel payment
  async cancelPayment(paymentId, userId) {
    try {
      const payments = await this.loadPayments();
      const paymentIndex = payments.findIndex(p => 
        p.paymentId === paymentId && (p.buyerId === userId || p.sellerId === userId)
      );

      if (paymentIndex === -1) {
        throw new Error('Payment not found or access denied');
      }

      const payment = payments[paymentIndex];
      
      if (payment.status === PAYMENT_STATUS.COMPLETED) {
        throw new Error('Cannot cancel completed payment');
      }

      payment.status = PAYMENT_STATUS.CANCELLED;
      payment.updatedAt = new Date().toISOString();
      
      payments[paymentIndex] = payment;
      await this.savePayments(payments);

      return {
        success: true,
        paymentId: payment.paymentId,
        status: payment.status
      };
    } catch (error) {
      console.error('Error cancelling payment:', error);
      throw new Error(error.message || 'Failed to cancel payment');
    }
  }

  // Calculate platform fee (percentage of transaction)
  calculatePlatformFee(amount, feePercentage = 2.5) {
    return Math.round(amount * (feePercentage / 100) * 100) / 100; // 2.5% platform fee
  }

  // Calculate seller payout (amount minus platform fee)
  calculateSellerPayout(amount, feePercentage = 2.5) {
    const platformFee = this.calculatePlatformFee(amount, feePercentage);
    return amount - platformFee;
  }

  // Get payment analytics for dashboard
  async getPaymentAnalytics(userId = null, role = null) {
    try {
      const payments = await this.loadPayments();
      const orders = await this.loadOrders();

      let filteredPayments = payments;
      let filteredOrders = orders;

      // Filter by user if specified
      if (userId && role) {
        if (role === 'buyer') {
          filteredPayments = payments.filter(p => p.buyerId === userId);
          filteredOrders = orders.filter(o => o.buyerId === userId);
        } else if (role === 'seller') {
          filteredPayments = payments.filter(p => p.sellerId === userId);
          filteredOrders = orders.filter(o => o.sellerId === userId);
        }
      }

      const analytics = {
        totalPayments: filteredPayments.length,
        totalOrders: filteredOrders.length,
        completedPayments: filteredPayments.filter(p => p.status === PAYMENT_STATUS.COMPLETED).length,
        pendingPayments: filteredPayments.filter(p => p.status === PAYMENT_STATUS.PENDING).length,
        failedPayments: filteredPayments.filter(p => p.status === PAYMENT_STATUS.FAILED).length,
        totalRevenue: filteredPayments
          .filter(p => p.status === PAYMENT_STATUS.COMPLETED)
          .reduce((sum, p) => sum + p.amount, 0),
        averageOrderValue: 0,
        paymentMethods: {},
        monthlyRevenue: this.getMonthlyRevenue(filteredPayments),
        recentPayments: filteredPayments
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 10)
      };

      // Calculate average order value
      if (analytics.completedPayments > 0) {
        analytics.averageOrderValue = analytics.totalRevenue / analytics.completedPayments;
      }

      // Calculate payment method distribution
      filteredPayments.forEach(payment => {
        analytics.paymentMethods[payment.method] = 
          (analytics.paymentMethods[payment.method] || 0) + 1;
      });

      return analytics;
    } catch (error) {
      console.error('Error getting payment analytics:', error);
      return {
        totalPayments: 0,
        totalOrders: 0,
        completedPayments: 0,
        pendingPayments: 0,
        failedPayments: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        paymentMethods: {},
        monthlyRevenue: [],
        recentPayments: []
      };
    }
  }

  // Get monthly revenue data for charts
  getMonthlyRevenue(payments) {
    const monthlyData = {};
    
    payments
      .filter(p => p.status === PAYMENT_STATUS.COMPLETED)
      .forEach(payment => {
        const date = new Date(payment.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + payment.amount;
      });

    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue }));
  }
}

// Export singleton instance
const paymentProcessor = new PaymentProcessor();

module.exports = {
  paymentProcessor,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  GCASH_CONFIG
};