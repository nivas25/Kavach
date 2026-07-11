import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    
    // Proxy directly to Fastify backend (use 127.0.0.1 to avoid Node IPv6 localhost issues)
    const fastifyUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080';
    
    const response = await fetch(`${fastifyUrl}/api/documents/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `Backend error: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Upload proxy error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
