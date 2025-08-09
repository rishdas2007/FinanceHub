import { Response } from 'express';
// HttpError will be imported from standardized-error-handler

export const createErrorResponse = (message: string, code?: string) => ({
  success: false,
  message,
  ...(code && { code })
});

export class ResponseUtils {
  static success(res: Response, data: any, message?: string) {
    return res.status(200).json({
      success: true,
      message: message || 'Success',
      data
    });
  }

  static created(res: Response, data: any, message?: string) {
    return res.status(201).json({
      success: true,
      message: message || 'Created successfully',
      data
    });
  }

  static badRequest(res: Response, message: string, errors?: any) {
    return res.status(400).json({
      success: false,
      message,
      errors
    });
  }

  static unauthorized(res: Response, message: string = 'Unauthorized') {
    return res.status(401).json({
      success: false,
      message
    });
  }

  static forbidden(res: Response, message: string = 'Forbidden') {
    return res.status(403).json({
      success: false,
      message
    });
  }

  static notFound(res: Response, message: string = 'Resource not found') {
    return res.status(404).json({
      success: false,
      message
    });
  }

  static internalError(res: Response, message: string = 'Internal server error') {
    return res.status(500).json({
      success: false,
      message
    });
  }

  static paginated(res: Response, data: any[], total: number, page: number, limit: number) {
    return res.status(200).json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  }
}