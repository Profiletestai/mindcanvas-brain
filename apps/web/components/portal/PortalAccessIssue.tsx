// apps/web/components/portal/PortalAccessIssue.tsx
import Link from "next/link";

export default function PortalAccessIssue(props: {
  title?: string;
  message?: string;
  backHref?: string;
  debug?: Record<string, any>;
  showDebug?: boolean;
}) {
  const title = props.title || "We couldn’t open this page";
  const message =
    props.message ||
    "This page may not exist in this environment, or you may not have access. If you believe this is a mistake, please contact support.";

  const backHref = props.backHref || "/portal";

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-600">{message}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={backHref}
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
          >
            Go back
          </Link>

          <Link
            href="/login"
            className="rounded-md border border-sky-500 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100"
          >
            Go to login
          </Link>
        </div>

        {props.showDebug && props.debug ? (
          <details className="mt-5 rounded-lg border bg-gray-50 p-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-800">
              Debug details
            </summary>
            <pre className="mt-3 overflow-auto text-xs text-gray-700">
              {JSON.stringify(props.debug, null, 2)}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}
