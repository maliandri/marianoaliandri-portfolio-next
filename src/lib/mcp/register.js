import { LEAD_TOOLS } from './tools/leads';
import { AUDIT_TOOLS } from './tools/audits';

// Todas las tools del servidor MCP. Para sumar una: definirla con defineTool() en
// src/lib/mcp/tools/<grupo>.js llamando a lógica de src/lib/, y agregarla acá.
export const ALL_TOOLS = [...LEAD_TOOLS, ...AUDIT_TOOLS];
