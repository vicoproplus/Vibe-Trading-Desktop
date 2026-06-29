// src/components/auth/SetPasswordModal.tsx
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { apiUser } from "@/lib/apiUser";

const fieldClass =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

export function SetPasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (pwd.length < 6) {
      toast.error(t("auth.setPassword.tooShort"));
      return;
    }
    if (pwd !== confirm) {
      toast.error(t("auth.setPassword.mismatch"));
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      await apiUser.setPassword(pwd);
      toast.success(t("auth.setPassword.success"));
      setPwd("");
      setConfirm("");
      onClose();
    } catch (e) {
      toast.error((e as Error).message || t("auth.setPassword.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-lg">
        <h2 className="mb-1 text-lg font-semibold tracking-tight">
          {t("auth.setPassword.title")}
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          {t("auth.setPassword.hint")}
        </p>
        <div className="space-y-3">
          <input
            className={fieldClass}
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder={t("auth.setPassword.new")}
            disabled={submitting}
          />
          <input
            className={fieldClass}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t("auth.setPassword.confirm")}
            disabled={submitting}
          />
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("auth.setPassword.submit")}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="inline-flex flex-1 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-60"
            >
              {t("auth.setPassword.skip")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
