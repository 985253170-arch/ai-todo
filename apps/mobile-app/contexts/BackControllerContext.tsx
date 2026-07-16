"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export interface BackHandler {
  id: string;
  priority: number;
  handle: () => boolean;
}

export interface BackController {
  register: (handler: BackHandler) => void;
  unregister: (id: string) => void;
  dispatchBack: () => boolean;
}

interface RegisteredHandler {
  handler: BackHandler;
  order: number;
}

const BackControllerContext = createContext<BackController | null>(null);

function createBackController(): BackController {
  const handlers = new Map<string, RegisteredHandler>();
  let nextOrder = 0;

  return {
    register(handler) {
      const existing = handlers.get(handler.id);
      handlers.set(handler.id, {
        handler,
        order: existing?.order ?? nextOrder++,
      });
    },
    unregister(id) {
      handlers.delete(id);
    },
    dispatchBack() {
      const orderedHandlers = [...handlers.values()].sort(
        (left, right) =>
          right.handler.priority - left.handler.priority || left.order - right.order,
      );

      for (const { handler } of orderedHandlers) {
        if (handler.handle()) {
          return true;
        }
      }

      return false;
    },
  };
}

const BASE_STATE = { app: "qingxing", kind: "base" } as const;
const GUARD_STATE = { app: "qingxing", kind: "guard" } as const;

function getExistingState(): Record<string, unknown> {
  const state = window.history.state;
  return typeof state === "object" && state !== null ? state : {};
}

function isQingxingState(
  state: unknown,
  kind: typeof BASE_STATE.kind | typeof GUARD_STATE.kind,
): boolean {
  return (
    typeof state === "object" &&
    state !== null &&
    (state as { app?: unknown; kind?: unknown }).app === "qingxing" &&
    (state as { kind?: unknown }).kind === kind
  );
}

function WebHistoryGuard({ controller }: { controller: BackController }) {
  const isExitingRef = useRef(false);

  useEffect(() => {
    const pushGuard = () => {
      const existingState = getExistingState();
      window.history.pushState(
        { ...existingState, ...GUARD_STATE },
        "",
      );
    };

    const ensureGuard = () => {
      if (isQingxingState(window.history.state, "guard")) {
        return;
      }

      if (isQingxingState(window.history.state, "base")) {
        pushGuard();
        return;
      }

      const existingState = getExistingState();
      window.history.replaceState(
        { ...existingState, ...BASE_STATE },
        "",
      );
      pushGuard();
    };

    const handlePopState = (event: PopStateEvent) => {
      if (isQingxingState(event.state, "base")) {
        if (isExitingRef.current) {
          return;
        }

        if (controller.dispatchBack()) {
          pushGuard();
          return;
        }

        isExitingRef.current = true;
        window.history.back();
        return;
      }

      if (isQingxingState(event.state, "guard")) {
        isExitingRef.current = false;
      }
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) {
        return;
      }

      isExitingRef.current = false;
      ensureGuard();
    };

    ensureGuard();
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [controller]);

  return null;
}

export function BackControllerProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(createBackController);

  return (
    <BackControllerContext.Provider value={controller}>
      <WebHistoryGuard controller={controller} />
      {children}
    </BackControllerContext.Provider>
  );
}

export function useBackController(): BackController {
  const controller = useContext(BackControllerContext);

  if (!controller) {
    throw new Error("useBackController must be used within BackControllerProvider");
  }

  return controller;
}
