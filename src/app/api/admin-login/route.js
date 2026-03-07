const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
      return Response.json({ error: 'Credenciales no configuradas' }, { status: 500 });
    }

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return Response.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Error en login' }, { status: 500 });
  }
}
