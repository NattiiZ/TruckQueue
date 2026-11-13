import { AppError } from '../utils/AppError.js';


const DB_DOWN = ['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_NO_SUCH_TABLE'];


export function notFound(req, res) 
{
  res.status(404).json({ error: 'Not found this API' });
}

export function errorHandler(err, req, res, next) 
{
  if (err instanceof AppError) 
  {
    return res.status(err.status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) });
  }

  console.error(err);


  if (DB_DOWN.includes(err.code)) 
    return res.status(503).json({ error: 'Can not connect to database' });

  res.status(500).json({ error: 'System error, please try again later' });
}
