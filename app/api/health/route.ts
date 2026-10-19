export function GET() {
  return Response.json(
    {
      status: "ok",
      aiConfigured: Boolean(
        process.env.AI_GATEWAY_API_KEY ||
        process.env.VERCEL_OIDC_TOKEN ||
        process.env.GROQ_API_KEY,
      ),
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
