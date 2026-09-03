import type { ReleaseChange } from "@/lib/releases";
import { CHANGE_TYPE_META, ChangeTypeIcon } from "./change-type-icon";

/** One structured change row: [icon] category label → title → description. */
export function ReleaseChangeItem({ change }: { change: ReleaseChange }) {
  const meta = CHANGE_TYPE_META[change.type];
  return (
    <li className="flex items-start gap-3.5 px-5 py-4">
      <ChangeTypeIcon type={change.type} />
      <div className="min-w-0 flex-1 space-y-1 pt-0.5">
        <p className="text-[11px] font-semibold text-muted-foreground">
          {meta.label}
        </p>
        <p className="text-sm leading-5 font-bold text-foreground">
          {change.title}
        </p>
        {change.description ? (
          <p className="text-[13px] leading-5 text-muted-foreground text-pretty">
            {change.description}
          </p>
        ) : null}
      </div>
    </li>
  );
}
