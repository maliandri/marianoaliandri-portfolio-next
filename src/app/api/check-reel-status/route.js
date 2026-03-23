// Shotstack removido — ya no hay polling de render.
// El flujo ahora es: Canvas API graba en browser → /api/upload-reel sube a Cloudinary.
export async function GET() {
  return Response.json(
    { error: 'Shotstack removido. No se necesita polling.' },
    { status: 410 }
  );
}
