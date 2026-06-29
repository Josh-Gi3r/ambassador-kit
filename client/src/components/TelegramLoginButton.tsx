/**
 * TelegramLoginButton
 *
 * Renders the official Telegram Login Widget and handles the auth callback.
 * After the user authenticates with Telegram, the widget calls window.onTelegramAuth
 * with the signed payload. We POST it to /api/auth/telegram, which verifies the
 * HMAC signature and sets a session cookie.
 *
 * The bot username is extracted from VITE_TELEGRAM_BOT_USERNAME env var.
 * Fallback: hardcoded to the configured bot.
 */
import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

const BOT_USERNAME = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? "").replace(/^@/, "");

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginButtonProps {
  onSuccess?: () => void;
  onError?: (msg: string) => void;
}

export default function TelegramLoginButton({ onSuccess, onError }: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  useEffect(() => {
    // Define the global callback the Telegram widget will call
    (window as unknown as Record<string, unknown>).onTelegramAuth = async (user: TelegramUser) => {
      try {
        const payload: Record<string, string> = {
          id: String(user.id),
          first_name: user.first_name,
          auth_date: String(user.auth_date),
          hash: user.hash,
        };
        if (user.last_name) payload.last_name = user.last_name;
        if (user.username) payload.username = user.username;
        if (user.photo_url) payload.photo_url = user.photo_url;

        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Login failed" }));
          onError?.(err.error ?? "Telegram login failed");
          return;
        }

        // Invalidate auth cache so useAuth() re-fetches the new session
        await utils.auth.me.invalidate();
        onSuccess?.();
      } catch (e) {
        onError?.("Network error during Telegram login");
      }
    };

    // Inject the Telegram widget script tag into the container
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
      const script = document.createElement("script");
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.setAttribute("data-telegram-login", BOT_USERNAME);
      script.setAttribute("data-size", "large");
      script.setAttribute("data-onauth", "onTelegramAuth(user)");
      script.setAttribute("data-request-access", "write");
      script.async = true;
      containerRef.current.appendChild(script);
    }

    return () => {
      delete (window as unknown as Record<string, unknown>).onTelegramAuth;
    };
  }, []);

  return <div ref={containerRef} style={{ display: "inline-block" }} />;
}
