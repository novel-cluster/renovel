import { Hono } from 'hono'
import { getHealth } from '@/presentation/controllers/health.controller'

export const healthRoutes = new Hono()

healthRoutes.get('/', getHealth)
