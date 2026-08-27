import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = "current-password",
  minLength,
  required = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          minLength={minLength}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          className="pr-11"
        />
        <button
          type="button"
          className={cn(
            "absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground",
            "hover:bg-muted hover:text-foreground",
          )}
          aria-label={show ? "Hide password" : "Show password"}
          onClick={() => setShow((v) => !v)}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}
