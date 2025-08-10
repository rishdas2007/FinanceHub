import { OpenAPIV3 } from 'openapi-types';

export const openApiSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'FinanceHub Pro API',
    description: 'Advanced financial intelligence platform API providing real-time market data, technical analysis, and AI-powered insights.',
    version: '2.0.0',
    contact: {
      name: 'FinanceHub Pro Support',
      url: 'https://financehub-pro.com/support',
      email: 'support@financehub-pro.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Version 1 API (Stable)'
    },
    {
      url: '/api/v2', 
      description: 'Version 2 API (Latest)'
    }
  ],
  paths: {
    '/ai-summary': {
      get: {
        tags: ['AI Analysis'],
        summary: 'Get AI-powered market summary',
        description: 'Returns comprehensive AI analysis of current market conditions including sentiment, technical indicators, and economic factors.',
        operationId: 'getAISummary',
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AISummaryResponse'
                }
              }
            }
          },
          '503': {
            description: 'AI analysis temporarily unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/sectors': {
      get: {
        tags: ['Market Data'],
        summary: 'Get sector ETF data',
        description: 'Returns current price and performance data for all major sector ETFs.',
        operationId: 'getSectors',
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/SectorData'
                  }
                }
              }
            }
          },
          '503': {
            description: 'Market data temporarily unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/stocks/{symbol}': {
      get: {
        tags: ['Market Data'],
        summary: 'Get stock quote',
        description: 'Returns current price and basic information for a specific stock symbol.',
        operationId: 'getStockQuote',
        parameters: [
          {
            name: 'symbol',
            in: 'path',
            required: true,
            description: 'Stock symbol (e.g., SPY, AAPL)',
            schema: {
              type: 'string',
              pattern: '^[A-Z]+$',
              example: 'SPY'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/StockQuote'
                }
              }
            }
          },
          '400': {
            description: 'Invalid stock symbol format',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          '503': {
            description: 'Stock data temporarily unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/stocks/{symbol}/history': {
      get: {
        tags: ['Market Data'],
        summary: 'Get stock price history',
        description: 'Returns paginated historical price data for a specific stock symbol.',
        operationId: 'getStockHistory',
        parameters: [
          {
            name: 'symbol',
            in: 'path',
            required: true,
            description: 'Stock symbol (e.g., SPY, AAPL)',
            schema: {
              type: 'string',
              pattern: '^[A-Z]+$',
              example: 'SPY'
            }
          },
          {
            name: 'page',
            in: 'query',
            description: 'Page number for pagination',
            schema: {
              type: 'integer',
              minimum: 1,
              default: 1
            }
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Number of records per page',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20
            }
          }
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PaginatedStockHistory'
                }
              }
            }
          },
          '400': {
            description: 'Invalid parameters',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/technical/{symbol}': {
      get: {
        tags: ['Technical Analysis'],
        summary: 'Get technical indicators',
        description: 'Returns technical analysis indicators (RSI, MACD, Bollinger Bands, etc.) for a specific stock symbol.',
        operationId: 'getTechnicalIndicators',
        parameters: [
          {
            name: 'symbol',
            in: 'path',
            required: true,
            description: 'Stock symbol (e.g., SPY, AAPL)',
            schema: {
              type: 'string',
              pattern: '^[A-Z]+$',
              example: 'SPY'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TechnicalIndicators'
                }
              }
            }
          },
          '400': {
            description: 'Invalid stock symbol format',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        description: 'Returns system health status and basic metrics.',
        operationId: 'getHealthCheck',
        responses: {
          '200': {
            description: 'System is healthy',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthCheck'
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      AISummaryResponse: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'AI-generated market summary'
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 100,
            description: 'Confidence score of the analysis'
          },
          keyInsights: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Key market insights'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Analysis timestamp'
          }
        },
        required: ['summary', 'confidence', 'timestamp']
      },
      SectorData: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Sector name'
          },
          symbol: {
            type: 'string',
            description: 'ETF symbol'
          },
          price: {
            type: 'number',
            description: 'Current price'
          },
          change: {
            type: 'number',
            description: 'Absolute price change'
          },
          changePercent: {
            type: 'number',
            description: 'Percentage change'
          },
          fiveDayChange: {
            type: 'number',
            description: '5-day percentage change'
          },
          oneMonthChange: {
            type: 'number',
            description: '1-month percentage change'
          }
        },
        required: ['name', 'symbol', 'price', 'changePercent']
      },
      StockQuote: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Stock symbol'
          },
          price: {
            type: 'number',
            description: 'Current price'
          },
          change: {
            type: 'number',
            description: 'Absolute price change'
          },
          changePercent: {
            type: 'number',
            description: 'Percentage change'
          },
          volume: {
            type: 'integer',
            description: 'Trading volume'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Last updated timestamp'
          }
        },
        required: ['symbol', 'price', 'changePercent', 'timestamp']
      },
      PaginatedStockHistory: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/StockQuote'
            }
          },
          pagination: {
            $ref: '#/components/schemas/PaginationInfo'
          }
        },
        required: ['data', 'pagination']
      },
      PaginationInfo: {
        type: 'object',
        properties: {
          page: {
            type: 'integer',
            description: 'Current page number'
          },
          limit: {
            type: 'integer',
            description: 'Records per page'
          },
          total: {
            type: 'integer',
            description: 'Total number of records'
          },
          totalPages: {
            type: 'integer',
            description: 'Total number of pages'
          }
        },
        required: ['page', 'limit', 'total', 'totalPages']
      },
      TechnicalIndicators: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Stock symbol'
          },
          rsi: {
            type: 'number',
            description: 'Relative Strength Index (0-100)'
          },
          macd: {
            type: 'number',
            description: 'MACD line value'
          },
          macdSignal: {
            type: 'number',
            description: 'MACD signal line value'
          },
          macdHistogram: {
            type: 'number',
            description: 'MACD histogram value'
          },
          bbUpper: {
            type: 'number',
            description: 'Bollinger Band upper bound'
          },
          bbMiddle: {
            type: 'number',
            description: 'Bollinger Band middle line (SMA)'
          },
          bbLower: {
            type: 'number',
            description: 'Bollinger Band lower bound'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Calculation timestamp'
          }
        },
        required: ['symbol', 'timestamp']
      },
      HealthCheck: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['healthy', 'degraded', 'unhealthy'],
            description: 'System health status'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Health check timestamp'
          },
          uptime: {
            type: 'number',
            description: 'System uptime in seconds'
          },
          version: {
            type: 'string',
            description: 'API version'
          },
          memory: {
            type: 'object',
            description: 'Memory usage statistics'
          }
        },
        required: ['status', 'timestamp', 'uptime']
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          message: {
            type: 'string',
            description: 'Error message'
          },
          code: {
            type: 'string',
            description: 'Error code'
          },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: {
                  type: 'string'
                },
                message: {
                  type: 'string'
                }
              }
            },
            description: 'Validation errors (if applicable)'
          }
        },
        required: ['success', 'message']
      }
    },
    securitySchemes: {
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key'
      }
    }
  },
  tags: [
    {
      name: 'AI Analysis',
      description: 'AI-powered market analysis and insights'
    },
    {
      name: 'Market Data',
      description: 'Real-time market data and quotes'
    },
    {
      name: 'Technical Analysis',
      description: 'Technical indicators and analysis'
    },
    {
      name: 'System',
      description: 'System health and monitoring'
    }
  ]
};