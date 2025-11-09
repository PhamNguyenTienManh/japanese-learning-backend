import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception.message || 'Internal server error';

    // Nếu getResponse() trả về object có message, lấy ra
    if (typeof message === 'object' && (message as any).message) {
      message = (message as any).message;
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
    });
  }
}
