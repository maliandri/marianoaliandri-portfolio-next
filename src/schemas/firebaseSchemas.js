// src/schemas/firebaseSchemas.js
// 🛡️ Schemas de validación con Zod para datos de Firebase
import { z } from 'zod';

/**
 * Schema para estadísticas básicas
 */
export const basicStatsSchema = z.object({
  totalVisits: z.number().int().nonnegative().default(0),
  uniqueVisitors: z.number().int().nonnegative().default(0),
  likes: z.number().int().nonnegative().default(0),
  dislikes: z.number().int().nonnegative().default(0),
  registeredUsers: z.number().int().nonnegative().default(0),
});

/**
 * Schema para página visitada
 */
export const pageViewSchema = z.object({
  id: z.string().optional(),
  path: z.string(),
  title: z.string(),
  views: z.number().int().nonnegative(),
  timestamp: z.union([z.date(), z.string()]).optional(),
});

/**
 * Schema para producto visitado
 */
export const productViewSchema = z.object({
  id: z.string().optional(),
  productId: z.string(),
  productName: z.string(),
  views: z.number().int().nonnegative(),
  timestamp: z.union([z.date(), z.string()]).optional(),
});

/**
 * Schema para estadísticas extendidas
 */
export const extendedStatsSchema = basicStatsSchema.extend({
  topPages: z.array(pageViewSchema).default([]),
  topProducts: z.array(productViewSchema).default([]),
  registeredUsers: z.number().int().nonnegative().default(0),
});

/**
 * Schema para datos de usuario autenticado
 */
export const userDataSchema = z.object({
  uid: z.string(),
  email: z.string().email().nullable(),
  displayName: z.string().nullable(),
  photoURL: z.string().url().nullable().optional(),
  emailVerified: z.boolean().optional(),
  createdAt: z.union([z.date(), z.string()]).optional(),
  lastLogin: z.union([z.date(), z.string()]).optional(),
});

/**
 * Schema para visitante
 */
export const visitorSchema = z.object({
  visitorId: z.string(),
  firstVisit: z.union([z.date(), z.string()]),
  lastVisit: z.union([z.date(), z.string()]),
  visitCount: z.number().int().positive(),
  userAgent: z.string().optional(),
});

/**
 * Schema para evento de analytics
 */
export const analyticsEventSchema = z.object({
  eventName: z.string(),
  eventParams: z.record(z.any()).optional(),
  timestamp: z.union([z.date(), z.string()]),
  userId: z.string().optional(),
  visitorId: z.string().optional(),
});

/**
 * Schema para formulario de contacto
 */
export const contactFormSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  email: z.string().email('Email inválido'),
  phone: z.string()
    .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, 'Teléfono inválido')
    .optional()
    .or(z.literal('')),
  message: z.string().min(10, 'El mensaje debe tener al menos 10 caracteres').max(1000),
  subject: z.string().optional(),
});

/**
 * Schema para calculadora web
 */
export const webCalculatorSchema = z.object({
  projectType: z.enum(['landing', 'ecommerce', 'corporate', 'blog', 'custom']),
  pages: z.number().int().positive().min(1).max(100),
  features: z.array(z.string()).optional(),
  hasAdmin: z.boolean().default(false),
  hasPayment: z.boolean().default(false),
  hasAPI: z.boolean().default(false),
  timeline: z.enum(['urgent', 'normal', 'flexible']).optional(),
});

/**
 * Schema para calculadora ROI
 */
export const roiCalculatorSchema = z.object({
  investment: z.number().positive('La inversión debe ser mayor a 0'),
  monthlyRevenue: z.number().nonnegative('Los ingresos no pueden ser negativos'),
  monthlyCosts: z.number().nonnegative('Los costos no pueden ser negativos'),
  conversionRate: z.number().min(0).max(100, 'La tasa de conversión debe estar entre 0 y 100'),
  averageTicket: z.number().positive('El ticket promedio debe ser mayor a 0').optional(),
});

/**
 * Schema para CV/Resume parseado
 */
export const resumeSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  skills: z.array(z.string()).default([]),
  experience: z.array(z.object({
    company: z.string(),
    position: z.string(),
    duration: z.string().optional(),
    description: z.string().optional(),
  })).optional(),
  education: z.array(z.object({
    institution: z.string(),
    degree: z.string(),
    year: z.string().optional(),
  })).optional(),
  score: z.number().min(0).max(100).optional(),
});

/**
 * Valida datos con un schema y retorna resultado seguro
 * @param {z.ZodSchema} schema - Schema de Zod
 * @param {any} data - Datos a validar
 * @returns {Object} { success: boolean, data?: any, error?: string }
 */
export function validateData(schema, data) {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      console.error('Validation error:', errorMessages);
      return { success: false, error: errorMessages };
    }
    return { success: false, error: 'Error de validación desconocido' };
  }
}

/**
 * Valida datos de forma segura y retorna valores por defecto si fallan
 * @param {z.ZodSchema} schema - Schema de Zod
 * @param {any} data - Datos a validar
 * @returns {any} Datos validados o valores por defecto
 */
export function safeValidate(schema, data) {
  const result = schema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  console.warn('Validation failed, using defaults:', result.error);

  // Intentar obtener valores por defecto del schema
  try {
    return schema.parse({});
  } catch {
    return null;
  }
}
