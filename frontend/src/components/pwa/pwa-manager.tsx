"use client";

import { Download, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PwaManager() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    let reloading = false;
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const iosHelpTimer = window.setTimeout(() => {
      setShowIosHelp(
        ios &&
          !standalone &&
          window.localStorage.getItem("bigu-ios-install-help-dismissed") !== "true",
      );
    }, 0);

    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let registration: ServiceWorkerRegistration | undefined;
    const inspectInstallingWorker = (worker: ServiceWorker | null) => {
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          setWaitingWorker(worker);
        }
      });
    };
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registered) => {
        registration = registered;
        if (registered.waiting) setWaitingWorker(registered.waiting);
        inspectInstallingWorker(registered.installing);
        registered.addEventListener("updatefound", () => {
          inspectInstallingWorker(registered.installing);
        });
      });
    const checkForUpdate = () => void registration?.update();
    window.addEventListener("focus", checkForUpdate);

    return () => {
      window.clearTimeout(iosHelpTimer);
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("focus", checkForUpdate);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };
  const dismissIosHelp = () => {
    window.localStorage.setItem("bigu-ios-install-help-dismissed", "true");
    setShowIosHelp(false);
  };

  if (!installPrompt && !waitingWorker && !showIosHelp) return null;

  return (
    <aside className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
      {waitingWorker ? (
        <div className="flex items-center gap-3 rounded-xl border bg-background p-3 shadow-lg">
          <p className="text-sm font-medium">Update available</p>
          <Button size="sm" onClick={() => waitingWorker.postMessage({ type: "SKIP_WAITING" })}>
            <RefreshCw /> Update
          </Button>
        </div>
      ) : null}
      {installPrompt ? (
        <div className="flex items-center gap-3 rounded-xl border bg-background p-3 shadow-lg">
          <p className="text-sm font-medium">Install BigU on this device</p>
          <Button size="sm" onClick={install}>
            <Download /> Install
          </Button>
        </div>
      ) : null}
      {showIosHelp ? (
        <div className="flex items-start gap-2 rounded-xl border bg-background p-3 shadow-lg">
          <p className="text-sm">To install BigU, open Share and choose Add to Home Screen.</p>
          <Button variant="ghost" size="icon-sm" aria-label="Dismiss install instructions" onClick={dismissIosHelp}>
            <X />
          </Button>
        </div>
      ) : null}
    </aside>
  );
}