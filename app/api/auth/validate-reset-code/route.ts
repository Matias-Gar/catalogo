import { NextResponse } from 'next/server';

// Recovery requires the Auth email link; email and CI do not prove identity.
export async function POST() {
  return NextResponse.json(
    { error: 'Solicita un enlace de recuperacion desde el inicio de sesion.' },
    { status: 410 },
  );
}
