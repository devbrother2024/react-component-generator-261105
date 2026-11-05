import { withModelFallback } from './fallback';
import { mapErrorMessage } from './errors';
import { createEventStream, anthropicTextDeltas, googleTextDeltas } from './stream';

// 우선순위 순서. 앞 모델이 실패하면 다음 모델로 폴백한다.
const GOOGLE_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash'];

const SYSTEM_PROMPT = `You are a React component generator. Generate a single React component based on the user's description.

Rules:
- Use inline styles only (no CSS imports, no CSS modules)
- Do NOT use import statements — React is already available in scope as a global
- Define the component as a function, then call render(<ComponentName />) at the end
- Make the component visually appealing with proper styling
- Use React hooks if needed (e.g., React.useState, React.useEffect)
- The component must be completely self-contained
- Respond with ONLY the code block — no explanations, no markdown fences
- Use descriptive variable names and clean formatting
- For colors, prefer modern palettes (gradients, shadows, etc.)
- Ensure the component is interactive where appropriate (hover states, click handlers, etc.)
- Do NOT use TypeScript syntax — no type annotations, no interfaces, no generics, no "as" casts. Write plain JavaScript only.

Example output format:
const GradientButton = () => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      style={{
        background: hovered
          ? 'linear-gradient(135deg, #667eea, #764ba2)'
          : 'linear-gradient(135deg, #764ba2, #667eea)',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '8px',
        fontSize: '16px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        transform: hovered ? 'scale(1.05)' : 'scale(1)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      Click me
    </button>
  );
};

render(<GradientButton />);`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type Provider = 'anthropic' | 'google';

const ENV_KEYS: Record<Provider, string | undefined> = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  google: process.env.GOOGLE_API_KEY,
};

function resolveApiKey(provider: Provider, clientKey?: string): string | null {
  return clientKey || ENV_KEYS[provider] || null;
}

// provider 호출은 "연결을 열고 응답 코드를 확인"한 뒤 텍스트 델타 스트림을 돌려준다.
// 연결 단계 에러(503/429 등)는 스트림이 시작되기 전에 던져져 기존처럼 HTTP 상태코드로 응답된다.
// 에러 메시지 포맷 `<이름> API error: <status>` 는 mapErrorMessage 가 의존한다.
// 스트림 본문 처리(anthropicTextDeltas / googleTextDeltas)는 테스트 가능하도록 stream.ts 에 있다.
async function openAnthropicStream(
  prompt: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<AsyncGenerator<string>> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  return anthropicTextDeltas(response.body);
}

async function openGoogleModelStream(
  prompt: string,
  apiKey: string,
  model: string,
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  // 키가 쿼리스트링에 실린다. 이 url 이나 fetch 에러 객체를 로그·응답에 넣지 마라.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 8192 },
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  return response.body;
}

// 모델 폴백은 연결 단계에서만 동작한다. 첫 바이트가 클라이언트로 나간 뒤에는 되돌릴 수 없으므로
// 스트림 도중 실패(MAX_TOKENS 절단 포함)는 폴백 없이 error 이벤트가 된다.
async function openGoogleStream(
  prompt: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<AsyncGenerator<string>> {
  const body = await withModelFallback(GOOGLE_MODELS, (model) =>
    openGoogleModelStream(prompt, apiKey, model, signal),
  );
  return googleTextDeltas(body);
}

const server = Bun.serve({
  port: 3002,
  // 모델의 첫 토큰이 늦어도 스트림 연결이 끊기지 않도록 기본값(10초)보다 넉넉히 둔다.
  idleTimeout: 120,
  async fetch(req) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/api/config') {
      return Response.json(
        {
          envKeys: {
            anthropic: !!ENV_KEYS.anthropic,
            google: !!ENV_KEYS.google,
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    if (req.method === 'POST' && url.pathname === '/api/generate') {
      try {
        const { prompt, apiKey, provider = 'anthropic' } = (await req.json()) as {
          prompt: string;
          apiKey?: string;
          provider?: Provider;
        };

        const resolvedKey = resolveApiKey(provider, apiKey);

        if (!resolvedKey) {
          return Response.json(
            { error: `API key is required. Set ${provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GOOGLE_API_KEY'} in .env or enter it manually.` },
            { status: 400, headers: CORS_HEADERS }
          );
        }

        if (!prompt) {
          return Response.json(
            { error: 'Prompt is required' },
            { status: 400, headers: CORS_HEADERS }
          );
        }

        // 클라이언트가 연결을 끊으면 업스트림 provider 요청도 중단한다.
        // 연결 단계(응답 헤더 전)의 끊김은 req.signal, 스트림 중의 끊김은 createEventStream 의 onCancel 이 맡는다.
        const upstream = new AbortController();
        req.signal.addEventListener('abort', () => upstream.abort(), { once: true });
        if (req.signal.aborted) upstream.abort(); // 리스너 등록 전에 이미 끊긴 경우

        const textStream =
          provider === 'google'
            ? await openGoogleStream(prompt, resolvedKey, upstream.signal)
            : await openAnthropicStream(prompt, resolvedKey, upstream.signal);

        return new Response(createEventStream(textStream, () => upstream.abort()), {
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-cache',
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const { status, error } = mapErrorMessage(message);

        return Response.json({ error }, { status, headers: CORS_HEADERS });
      }
    }

    return Response.json(
      { error: 'Not found' },
      { status: 404, headers: CORS_HEADERS }
    );
  },
});

console.log(`API server running at http://localhost:${server.port}`);
