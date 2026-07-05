"use client";

import { useEffect, useRef } from "react";

const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

type TurnstileTheme = "auto" | "light" | "dark";

interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
  theme?: TurnstileTheme;
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  onTokenChange: (token: string | null) => void;
  onLoadError?: () => void;
}

let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.turnstile) {
    return Promise.resolve();
  }

  if (!turnstileScriptPromise) {
    turnstileScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[src="${TURNSTILE_SCRIPT_SRC}"]`,
      );

      const timeoutId = window.setTimeout(() => {
        reject(new Error("TURNSTILE_LOAD_TIMEOUT"));
      }, 8000);

      function handleLoad() {
        window.clearTimeout(timeoutId);
        resolve();
      }

      function handleError() {
        window.clearTimeout(timeoutId);
        reject(new Error("TURNSTILE_LOAD_FAILED"));
      }

      if (existingScript) {
        existingScript.addEventListener("load", handleLoad, { once: true });
        existingScript.addEventListener("error", handleError, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.async = true;
      script.defer = true;
      script.src = TURNSTILE_SCRIPT_SRC;
      script.addEventListener("load", handleLoad, { once: true });
      script.addEventListener("error", handleError, { once: true });
      document.body.appendChild(script);
    });
  }

  return turnstileScriptPromise;
}

export function TurnstileWidget({
  onTokenChange,
  onLoadError,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function renderTurnstile() {
      try {
        await loadTurnstileScript();

        if (!isMounted || !containerRef.current || !window.turnstile) {
          onTokenChange(null);
          onLoadError?.();
          return;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey:
            process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ??
            TURNSTILE_TEST_SITE_KEY,
          theme: "auto",
          callback: (token) => {
            onTokenChange(token);
          },
          "expired-callback": () => {
            onTokenChange(null);
          },
          "error-callback": () => {
            onTokenChange(null);
            onLoadError?.();
          },
        });
      } catch {
        if (isMounted) {
          onTokenChange(null);
          onLoadError?.();
        }
      }
    }

    void renderTurnstile();

    return () => {
      isMounted = false;
      onTokenChange(null);

      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [onLoadError, onTokenChange]);

  return (
    <div className="min-h-[65px]">
      {/* If Supabase CAPTCHA is Required, requests without a token will be rejected by Supabase. */}
      <div ref={containerRef} />
    </div>
  );
}
