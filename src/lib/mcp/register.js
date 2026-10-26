import { LEAD_TOOLS } from './tools/leads';
import { AUDIT_TOOLS } from './tools/audits';
import { EMAIL_TOOLS } from './tools/email';
import { INSTAGRAM_TOOLS } from './tools/instagram';

// Todas las tools del servidor MCP. Para sumar una: definirla con defineTool() en
// src/lib/mcp/tools/<grupo>.js llamando a lógica de src/lib/, y agregarla acá.
export const ALL_TOOLS = [...LEAD_TOOLS, ...AUDIT_TOOLS, ...EMAIL_TOOLS, ...INSTAGRAM_TOOLS];
