import { DEFAULT_PORT } from '@lan-share/shared';

export const config = {
  port: Number(process.env.PORT) || DEFAULT_PORT,
  host: '0.0.0.0',
};