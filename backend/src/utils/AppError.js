export class AppError extends Error 
{
  constructor(message, status = 400, code = undefined) 
  {
    super(message);
    this.status = status;
    this.code = code;
  }
}
