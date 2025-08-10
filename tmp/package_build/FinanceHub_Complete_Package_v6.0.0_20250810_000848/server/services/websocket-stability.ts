import { WebSocket } from 'ws';
import { logger } from '../utils/logger';

/**
 * WEEK 2: WEBSOCKET STABILITY IMPROVEMENTS
 * Enhanced connection management, reconnection logic, and error handling
 */

export interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  pingInterval: number;
  heartbeatTimeout: number;
  messageTimeout: number;
}

export interface ConnectionMetrics {
  connected: boolean;
  reconnectAttempts: number;
  lastConnected: Date | null;
  lastDisconnected: Date | null;
  totalMessages: number;
  errorCount: number;
  averageLatency: number;
}

export class EnhancedWebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: any[] = [];
  private isReconnecting = false;
  
  private metrics: ConnectionMetrics = {
    connected: false,
    reconnectAttempts: 0,
    lastConnected: null,
    lastDisconnected: null,
    totalMessages: 0,
    errorCount: 0,
    averageLatency: 0
  };

  private latencyMeasurements: number[] = [];

  constructor(
    private config: WebSocketConfig,
    private onMessage: (data: any) => void,
    private onConnect?: () => void,
    private onDisconnect?: () => void
  ) {}

  /**
   * Connect with enhanced error handling and connection state management
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      logger.debug('WebSocket already connected');
      return;
    }

    if (this.isReconnecting) {
      logger.debug('Reconnection already in progress');
      return;
    }

    try {
      logger.info(`🔌 Connecting to WebSocket: ${this.config.url}`);
      
      // Create new WebSocket connection
      this.ws = new WebSocket(this.config.url, {
        handshakeTimeout: 10000,
        perMessageDeflate: false // Disable compression for better performance
      });

      this.setupEventHandlers();
      
      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          logger.error('❌ WebSocket connection timeout');
          this.ws.terminate();
          this.handleConnectionFailure();
        }
      }, 15000);

      // Wait for connection to be established
      await new Promise<void>((resolve, reject) => {
        if (!this.ws) {
          reject(new Error('WebSocket not initialized'));
          return;
        }

        this.ws.once('open', () => {
          clearTimeout(connectionTimeout);
          this.handleConnectionSuccess();
          resolve();
        });

        this.ws.once('error', (error) => {
          clearTimeout(connectionTimeout);
          reject(error);
        });
      });

    } catch (error) {
      logger.error('❌ WebSocket connection failed:', error);
      this.handleConnectionFailure();
      throw error;
    }
  }

  /**
   * Enhanced event handlers with comprehensive error handling
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.on('open', () => {
      this.handleConnectionSuccess();
    });

    this.ws.on('message', (data: Buffer) => {
      this.handleMessage(data);
    });

    this.ws.on('error', (error: Error) => {
      this.handleError(error);
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.handleClose(code, reason.toString());
    });

    this.ws.on('ping', () => {
      this.handlePing();
    });

    this.ws.on('pong', () => {
      this.handlePong();
    });
  }

  /**
   * Handle successful connection
   */
  private handleConnectionSuccess(): void {
    logger.info('✅ WebSocket connected successfully');
    
    this.metrics.connected = true;
    this.metrics.lastConnected = new Date();
    this.metrics.reconnectAttempts = 0;
    this.isReconnecting = false;

    // Clear any existing timers
    this.clearTimers();

    // Start heartbeat mechanism
    this.startHeartbeat();

    // Process queued messages
    this.processMessageQueue();

    // Notify connection success
    if (this.onConnect) {
      this.onConnect();
    }
  }

  /**
   * Handle connection failure
   */
  private handleConnectionFailure(): void {
    this.metrics.connected = false;
    this.metrics.lastDisconnected = new Date();
    this.metrics.errorCount++;

    this.clearTimers();

    if (!this.isReconnecting && this.metrics.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else if (this.metrics.reconnectAttempts >= this.config.maxReconnectAttempts) {
      logger.error(`❌ Max reconnection attempts (${this.config.maxReconnectAttempts}) reached`);
      if (this.onDisconnect) {
        this.onDisconnect();
      }
    }
  }

  /**
   * Handle incoming messages with latency tracking
   */
  private handleMessage(data: Buffer): void {
    const receiveTime = Date.now();
    
    try {
      const message = JSON.parse(data.toString());
      
      // Track latency if message contains timestamp
      if (message.timestamp) {
        const latency = receiveTime - message.timestamp;
        this.trackLatency(latency);
      }

      this.metrics.totalMessages++;
      this.onMessage(message);
      
    } catch (error) {
      logger.error('❌ Error parsing WebSocket message:', error);
      this.metrics.errorCount++;
    }
  }

  /**
   * Handle WebSocket errors
   */
  private handleError(error: Error): void {
    logger.error('❌ WebSocket error:', error);
    this.metrics.errorCount++;
    
    // Categorize error types for better handling
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('timeout')) {
      logger.warn('⏰ WebSocket timeout detected, attempting reconnect');
      this.handleConnectionFailure();
    } else if (errorMessage.includes('network') || errorMessage.includes('econnreset')) {
      logger.warn('🌐 Network error detected, attempting reconnect');
      this.handleConnectionFailure();
    } else {
      // For other errors, log but don't automatically reconnect
      logger.error('🚨 Unexpected WebSocket error:', error);
    }
  }

  /**
   * Handle connection close
   */
  private handleClose(code: number, reason: string): void {
    logger.info(`🔌 WebSocket closed - Code: ${code}, Reason: ${reason}`);
    
    this.metrics.connected = false;
    this.metrics.lastDisconnected = new Date();
    
    this.clearTimers();

    // Determine if reconnection should be attempted based on close code
    const shouldReconnect = this.shouldReconnectOnClose(code);
    
    if (shouldReconnect && this.metrics.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      if (this.onDisconnect) {
        this.onDisconnect();
      }
    }
  }

  /**
   * Determine if reconnection should be attempted based on close code
   */
  private shouldReconnectOnClose(code: number): boolean {
    // WebSocket close codes that should trigger reconnection
    const reconnectCodes = [
      1006, // Abnormal closure
      1011, // Server error
      1012, // Service restart
      1013, // Try again later
      1014  // Bad gateway
    ];
    
    return reconnectCodes.includes(code);
  }

  /**
   * Start heartbeat mechanism to keep connection alive
   */
  private startHeartbeat(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const pingTime = Date.now();
        this.ws.ping(Buffer.from(pingTime.toString()));
        
        // Set heartbeat timeout
        this.heartbeatTimer = setTimeout(() => {
          logger.warn('💔 Heartbeat timeout, connection may be stale');
          this.handleConnectionFailure();
        }, this.config.heartbeatTimeout);
      }
    }, this.config.pingInterval);
  }

  /**
   * Handle ping from server
   */
  private handlePing(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.pong();
    }
  }

  /**
   * Handle pong from server
   */
  private handlePong(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.isReconnecting) return;
    
    this.isReconnecting = true;
    this.metrics.reconnectAttempts++;
    
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.metrics.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );
    
    logger.info(`🔄 Scheduling reconnection attempt ${this.metrics.reconnectAttempts}/${this.config.maxReconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        logger.error('❌ Reconnection attempt failed:', error);
        this.isReconnecting = false;
        this.handleConnectionFailure();
      }
    }, delay);
  }

  /**
   * Send message with queue management
   */
  send(message: any): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const messageWithTimestamp = {
          ...message,
          timestamp: Date.now()
        };
        this.ws.send(JSON.stringify(messageWithTimestamp));
        return true;
      } catch (error) {
        logger.error('❌ Error sending WebSocket message:', error);
        this.queueMessage(message);
        return false;
      }
    } else {
      this.queueMessage(message);
      return false;
    }
  }

  /**
   * Queue message for later sending
   */
  private queueMessage(message: any): void {
    if (this.messageQueue.length < 100) { // Prevent memory issues
      this.messageQueue.push(message);
    } else {
      logger.warn('⚠️ Message queue full, dropping oldest message');
      this.messageQueue.shift();
      this.messageQueue.push(message);
    }
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (!this.send(message)) {
        // If send fails, put message back at front of queue
        this.messageQueue.unshift(message);
        break;
      }
    }
  }

  /**
   * Track latency measurements
   */
  private trackLatency(latency: number): void {
    this.latencyMeasurements.push(latency);
    
    // Keep only last 100 measurements
    if (this.latencyMeasurements.length > 100) {
      this.latencyMeasurements.shift();
    }
    
    // Calculate average latency
    const sum = this.latencyMeasurements.reduce((a, b) => a + b, 0);
    this.metrics.averageLatency = sum / this.latencyMeasurements.length;
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Get connection metrics
   */
  getMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  /**
   * Get connection health score (0-100)
   */
  getHealthScore(): number {
    if (!this.metrics.connected) return 0;
    
    let score = 100;
    
    // Penalize for errors
    if (this.metrics.errorCount > 0) {
      score -= Math.min(50, this.metrics.errorCount * 5);
    }
    
    // Penalize for high latency
    if (this.metrics.averageLatency > 1000) {
      score -= Math.min(30, (this.metrics.averageLatency - 1000) / 100);
    }
    
    // Penalize for recent reconnects
    if (this.metrics.reconnectAttempts > 0) {
      score -= Math.min(20, this.metrics.reconnectAttempts * 10);
    }
    
    return Math.max(0, Math.round(score));
  }

  /**
   * Graceful disconnect
   */
  disconnect(): void {
    logger.info('🔌 Disconnecting WebSocket gracefully');
    
    this.clearTimers();
    
    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }
    
    this.metrics.connected = false;
    this.isReconnecting = false;
  }
}

// Factory for creating configured WebSocket managers
export function createWebSocketManager(
  config: Partial<WebSocketConfig>,
  onMessage: (data: any) => void,
  onConnect?: () => void,
  onDisconnect?: () => void
): EnhancedWebSocketManager {
  const defaultConfig: WebSocketConfig = {
    url: 'wss://ws.twelvedata.com/v1/quotes/price',
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
    pingInterval: 30000,
    heartbeatTimeout: 45000,
    messageTimeout: 10000
  };

  const finalConfig = { ...defaultConfig, ...config };
  
  return new EnhancedWebSocketManager(
    finalConfig,
    onMessage,
    onConnect,
    onDisconnect
  );
}