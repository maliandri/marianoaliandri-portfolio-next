// Shotstack removido — el generador de reels ahora usa Canvas API en el browser.
// Ver: src/utils/canvasReelService.js + src/components/admin/CanvasReelGenerator.jsx
// El upload se hace via /api/upload-reel
export async function POST() {
  return Response.json(
    { error: 'Shotstack removido. Usar Canvas API + /api/upload-reel.' },
    { status: 410 }
  );
}
