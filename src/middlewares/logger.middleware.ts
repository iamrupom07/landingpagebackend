import morgan from 'morgan';
import { env } from '../config/env';

export const requestLogger =
  env.NODE_ENV === 'production'
    ? morgan((tokens, req, res) =>
        JSON.stringify({
          ts:     tokens.date(req, res, 'iso'),
          method: tokens.method(req, res),
          url:    tokens.url(req, res),
          status: Number(tokens.status(req, res)),
          ms:     Number(tokens['response-time'](req, res)),
          ip:     tokens['remote-addr'](req, res),
          ua:     tokens['user-agent'](req, res),
        })
      )
    : morgan('dev');
