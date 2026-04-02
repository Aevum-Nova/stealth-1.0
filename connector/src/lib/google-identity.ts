const GOOGLE_IDENTITY_SCRIPT_ID = "google-identity-services";
const GOOGLE_IDENTITY_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

let googleIdentityScriptPromise: Promise<void> | null = null;

export interface GoogleCredentialResponse {
  credential?: string;
}

export interface GoogleIdentityApi {
  accounts: {
    id: {
      cancel: () => void;
      disableAutoSelect: () => void;
      initialize: (options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        auto_select?: boolean;
      }) => void;
      prompt: () => void;
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
}

export function getGoogleIdentityApi(): GoogleIdentityApi | null {
  if (typeof window === "undefined") {
    return null;
  }

  return (window as Window & { google?: GoogleIdentityApi }).google ?? null;
}

export function disableGoogleAutoSelect(): void {
  getGoogleIdentityApi()?.accounts?.id?.disableAutoSelect?.();
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google identity script can only be loaded in the browser"));
  }

  if (getGoogleIdentityApi()?.accounts?.id) {
    return Promise.resolve();
  }

  if (googleIdentityScriptPromise) {
    return googleIdentityScriptPromise;
  }

  googleIdentityScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Google identity script")), {
        once: true
      });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_IDENTITY_SCRIPT_ID;
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google identity script"));
    document.head.appendChild(script);
  });

  return googleIdentityScriptPromise;
}
